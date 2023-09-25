"use strict";
const { createCoreController } = require("@strapi/strapi").factories;
const {
  CONFIG,
  C_TYPES,
  USER,
  TYPES,
  API_ACTIONS,
} = require("../../../../utils/constants.js");

const { FUNCTIONS, STRAPI } = require("../../../../utils/functions.js");

module.exports = createCoreController(
  "api::usercard.usercard",
  ({ strapi }) => ({
    async resetUser(ctx) {
      if (!CONFIG.ALLOWED_EMAILS.includes(ctx.state.user.email)) {
        ctx.throw(403, "You are not allowed to reset the user.");
      }
      // ADD SECURITY CHECK FOR MY PERSONAL USERNAME IF NOT => RETURN 403
      const user = ctx.state.user;
      const payload = USER.TEST_USER_DATA;

      const populate = FUNCTIONS.makePopulate([
        "usercards.card",
        "artifacts",
        "claimed_artifacts",
        "avatar.image",
        "card_tickets",
        "shared_by",
        "shared_buddies.avatar.image",
      ]);

      const data = STRAPI.updateUser(user.id, payload, populate);

      // EXPENSIVE FUNCTION CALCULATE ALL RELATION COUNTS FOR CARDS!!!
      await FUNCTIONS.updateRelationCountForAllCards();

      return data;
    },
    // CARD
    // @TODO check security here...
    async updateContentType(ctx) {
      const { action, contentType, contentTypeId, cardId } = ctx.request.body;

      const propertyName = `saved${contentType
        .charAt(0)
        .toUpperCase()}${contentType.slice(1)}`;

      const user = await STRAPI.getUser(ctx.state.user.id, {
        [propertyName]: true,
        last_completed_cards: true,
      });

      const contentTypeIdParsed = parseInt(contentTypeId);

      const isValidContentType = (contentType) =>
        contentType in C_TYPES.CONTENT_MAP ? true : false;

      if (!isValidContentType(contentType)) {
        ctx.throw(400, "Invalid content type");
      }

      const formattedContentType = C_TYPES.CONTENT_MAP[contentType].single;
      const contentTypeData =
        action == API_ACTIONS.updateContentType.claim
          ? { isOpen: true }
          : await strapi.db
              .query(`api::${formattedContentType}.${formattedContentType}`)
              .findOne({
                where: { id: contentTypeId },
              });

      const card = await strapi.db.query("api::card.card").findOne({
        where: {
          id: cardId,
        },
      });

      let userCard = await STRAPI.getOrCreateUserCard(ctx, card);

      console.log("original", userCard);

      let progressMap = userCard?.progressMap || {};

      if (!progressMap[contentType]) {
        progressMap[contentType] = {};
      }

      if (!progressMap[contentType][contentTypeId]) {
        if (contentTypeData.isOpen) {
          progressMap[contentType][contentTypeId] = {
            completed: 0,
            saved: false,
          };
        } else {
          return ctx.throw(403, "You haven't unlocked this content yet.");
        }
      }

      if (action == API_ACTIONS.updateContentType.removeNew) {
        progressMap[contentType][contentTypeId] = {
          ...progressMap[contentType][contentTypeId],
          isNew: false,
        };

        await strapi.db.query(CONFIG.API_PATH).update({
          where: { id: userCard.id },
          data: {
            progressMap,
          },
        });

        return { success: true };
      }

      if (action == API_ACTIONS.updateContentType.save) {
        // BOOKMARK IN RELATION IN USER
        let newSavedContent = user[propertyName] || [];

        const alreadySaved =
          newSavedContent.length > 0 &&
          newSavedContent.filter((c) => c.id == contentTypeIdParsed).length > 0;

        if (alreadySaved) {
          newSavedContent = newSavedContent.filter(
            (c) => c.id != contentTypeIdParsed
          );
        } else {
          newSavedContent.push(contentTypeIdParsed);
        }

        const userUpdate = {
          [propertyName]: newSavedContent,
        };

        const userData = STRAPI.updateUser(user.id, userUpdate);

        // BOOKMARK IN PROGRESSMAP IN USERCARD

        progressMap[contentType][contentTypeId] = {
          ...progressMap[contentType][contentTypeId],
          saved: !progressMap[contentType][contentTypeId].saved,
        };

        // SAVE USERCARD - PROGRESSMAP
        await strapi.db.query(CONFIG.API_PATH).update({
          where: { id: userCard.id },
          data: {
            progressMap,
          },
        });

        return userData;
      }

      if (action == API_ACTIONS.updateContentType.complete) {
        // check 24 hours
        const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        if (
          Date.now() -
            userCard.progressMap[contentType][contentTypeId].lastTime <
          oneDay
        ) {
          return ctx.throw(
            400,
            "You need to wait 24 hours before updating progress again."
          );
        }

        // check energy
        if (user.energy < 1) {
          return ctx.throw(400, "You don't have enough energy.");
        }

        if (
          progressMap[contentType][contentTypeId].completed <
          C_TYPES.CONTENT_MAP[contentType].max
        ) {
          progressMap[contentType][contentTypeId] = {
            completed: progressMap[contentType][contentTypeId].completed + 1,
            lastTime: Date.now(),
          };
        } else {
          ctx.throw(400, "You have already completed this content type.");
        }

        // LAST COMPLETED UPDATE + energy reduce
        let new_last_completed = user.last_completed_cards;
        new_last_completed.push(cardId);
        if (new_last_completed.length > CONFIG.MAX_COMPLETED_CARDS) {
          new_last_completed.shift();
        }

        const payload = {
          last_completed_cards: new_last_completed,
          energy: user.energy - 1,
        };

        await STRAPI.updateUser(user.id, payload);

        // update the PROGRESSQUEST
        let progressQuest = userCard.progressQuest ?? {};

        progressQuest[contentType] ??= {
          level: 1,
          progress: 0,
        };

        progressQuest[contentType].progress++;

        userCard = await strapi.db.query(CONFIG.API_PATH).update({
          where: { id: userCard.id },
          data: {
            progressMap,
            progressQuest,
            level: userCard.level + 1, // level = how many times you complete a single content type
          },
        });

        const objectivesForNotification = await strapi
          .service(CONFIG.API_PATH)
          .objectivesTrigger(user, TYPES.OBJECTIVE_TRIGGERS.master_card);

        const artifact = await strapi
          .service(CONFIG.API_PATH)
          .achievementTrigger(user, TYPES.STATS_OPTIONS[contentType]);

        // update stats
        await STRAPI.updateStats(user, TYPES.STATS_OPTIONS.mastery);
        // TODO achivemnet trigger add here + update trigger achivement multidimensional for {contentType}

        return {
          usercard: userCard,
          objectivesForNotification,
          ...(artifact && { artifact }),
        };
      }

      if (action == API_ACTIONS.updateContentType.claim) {
        let progressQuest = userCard.progressQuest;

        if (!progressQuest) {
          return ctx.throw(400, "You have not completed any content yet.");
        }
        if (
          progressQuest[contentType].progress <
          C_TYPES.CONTENT_MAP[contentType].max
        ) {
          return ctx.throw(
            400,
            "You don't have enough mastery to claim this quest"
          );
        }
        // claim quest

        progressQuest[contentType].level++;
        progressQuest[contentType].progress =
          progressQuest[contentType].progress -
          C_TYPES.CONTENT_MAP[contentType].max;

        // ROLL RANDOM CONTENT TYPE
        const randomReward = await strapi
          .service(CONFIG.API_PATH)
          .getRandomUndroppedContent(ctx, user);

        const { reward, rewardType, error } = randomReward;
        if (error) {
          ctx.throw(400, "No rewards available.");
        }

        const formattedContentType = C_TYPES.CONTENT_MAP[rewardType].single;

        const cardFromReward = await strapi.entityService.findOne(
          `api::${formattedContentType}.${formattedContentType}`,
          reward.id,
          {
            fields: ["id"],
            populate: {
              card: {
                populate: {
                  image: true,
                  realm: {
                    populate: {
                      image: true,
                    },
                  },
                },
              },
            },
          }
        );

        const usercardFromReward = await STRAPI.getOrCreateUserCard(
          ctx,
          cardFromReward.card
        );

        // UPDATE PROGRESSMAP IN USERCARD WHERE REWARD DROPPED ->
        let progressMapFromReward = usercardFromReward.progressMap || {};

        if (!progressMapFromReward[rewardType]) {
          progressMapFromReward[rewardType] = {};
        }

        progressMapFromReward[rewardType][reward.id] =
          C_TYPES.DEFAULT_PROGRESS_MAP;

        await strapi.entityService.update(
          CONFIG.API_PATH,
          usercardFromReward.id,
          {
            data: {
              progressMap: progressMapFromReward,
            },
          }
        );

        // UPDATE DROPPEDCONTENT JSON IN USER ->
        const droppedContent = user.droppedContent || {};

        const xpRewards = await strapi.service(CONFIG.API_PATH).gainXp(user);

        const userUpdate = {
          stars: user.stars + CONFIG.XP_FROM_QUEST,
          // xp from function -> gainXp
          droppedContent: {
            ...droppedContent,
            [rewardType]: droppedContent[rewardType]
              ? [...droppedContent[rewardType], reward.id]
              : [reward.id],
          },
        };

        await STRAPI.updateUser(user.id, userUpdate);

        // UPDATE THE PROGRESS QUEST IN THE ORIGINAL USERCARD ->
        userCard = await strapi.db.query(CONFIG.API_PATH).update({
          where: { id: userCard.id },
          data: {
            progressQuest,
          },
        });

        const artifact = await strapi
          .service(CONFIG.API_PATH)
          .achievementTrigger(user, TYPES.STATS_OPTIONS.quests_claimed);

        const objectivesForQuest = await strapi
          .service(CONFIG.API_PATH)
          .objectivesTrigger(user, TYPES.OBJECTIVE_TRIGGERS.action); // action == quest

        return {
          rewards: {
            stars: CONFIG.XP_FROM_QUEST,
            xp: xpRewards,
            content: { ...reward, type: rewardType },
            cardMeta: cardFromReward.card,
            artifact,
          },
        };
      }
    },

    async updateCard(ctx) {
      const user = await STRAPI.getUser(ctx.state.user.id, {
        last_completed_cards: true,
        last_unlocked_cards: true,
        favorite_cards: true,
        artifacts: true,
      });

      const card_id = parseInt(ctx.request.body.cardId);
      const action = ctx.request.body.action;
      const contentIndex = ctx.request.body.contentIndex || 0;

      if (!Object.values(API_ACTIONS.updateCard).includes(action)) {
        return ctx.badRequest("You can't update the card with unknown intent.");
      }

      const updateCardRes = await strapi
        .service(CONFIG.API_PATH)
        .updateCard(user, card_id, action, ctx, contentIndex);

      const card = await strapi.db.query("api::card.card").findOne({
        where: {
          id: card_id,
        },
        populate: {
          image: true,
          realm: {
            populate: {
              image: true,
            },
          },
        },
      });

      let userCardWithCard = updateCardRes.usercard;
      userCardWithCard.card = card;

      return {
        userCardWithCard,
        objectivesForNotification: updateCardRes.objectivesForNotification,
      };
    },

    async buyCardTicket(ctx) {
      const user = await STRAPI.getUser(ctx.state.user.id, {
        card_tickets: true,
      });

      if (user.energy <= 0) {
        ctx.throw(400, "You don't have enough energy to play this card.");
      }

      const card_id = parseInt(ctx.request.body.cardId);

      const card = await strapi.db.query("api::card.card").findOne({
        where: {
          id: card_id,
        },
      });

      const usercard = await STRAPI.getOrCreateUserCard(ctx, card);

      const upload = {
        card_tickets: [...user.card_tickets, card_id],
        energy: user.energy - CONFIG.TICKET_PRICE,
      };

      await STRAPI.updateUser(user.id, upload);
      return { userCardWithCard: { ...usercard, card: { id: card_id } } };
    },

    async rateCard(ctx) {
      const availableRatings = CONFIG.CARD_RATINGS;
      const user = await STRAPI.getUser(ctx.state.user.id);
      const rating = ctx.request.body.rating;
      const cardId = parseInt(ctx.request.body.cardId);
      const feedbackType = ctx.request.body.feedbackType;
      let upload;
      let hasRated = false;

      if (!Object.values(TYPES.FEEDBACK_TYPES).includes(feedbackType)) {
        ctx.throw(400, "Invalid input, must be a valid feedback type");
      }

      const usercard = await STRAPI.getUserCard(user.id, cardId);

      if (!usercard) {
        ctx.throw(400, "invalid card, you don't have this card unlocked yet");
      }
      // IF RATING
      if (feedbackType === TYPES.FEEDBACK_TYPES.rating) {
        if (typeof rating !== "number" && !availableRatings.includes(rating)) {
          ctx.throw(400, "invalid input, must be proper rating number");
        }
        const requirement = TYPES.STATS_OPTIONS.rated_cards;
        await STRAPI.updateStats(user, requirement);
        upload = {
          rating: rating,
        };
      }
      // IF MESSAGE
      if (feedbackType === TYPES.FEEDBACK_TYPES.message) {
        const requirement = TYPES.STATS_OPTIONS.feedback_cards;
        await STRAPI.updateStats(user, requirement);
        upload = {
          message: rating,
          isRated: true,
        };
      }

      if (!usercard.isRated) {
        await strapi
          .service(CONFIG.API_PATH)
          .gainReward(user, "stars", CONFIG.STARS_REWARD_FROM_RATING);
        hasRated = true;
      }

      const usercardUpdated = await strapi.db.query(CONFIG.API_PATH).update({
        where: { user: user.id, card: cardId },
        data: upload,
      });

      return {
        usercard: usercardUpdated,
        hasRated,
        rewards: { stars: CONFIG.STARS_REWARD_FROM_RATING },
      };
    },
    async refreshUser(ctx) {
      const user = ctx.state.user;

      if (!user) {
        return ctx.badRequest(null, [
          { messages: [{ id: "No authorization header was found" }] },
        ]);
      }

      const data = await STRAPI.getUser(user.id, {
        avatar: {
          populate: {
            image: true,
          },
        },
        card_tickets: {
          populate: true,
        },
      });

      return data;
    },

    // TODAY
    async me(ctx) {
      const user = ctx.state.user;

      if (!user) {
        return ctx.badRequest(null, [
          { messages: [{ id: "No authorization header was found" }] },
        ]);
      }

      const artifacts_count = await strapi.db
        .query("api::artifact.artifact")
        .count();

      const cards_count = await strapi.db
        .query("api::card.card")
        .count({ is_open: false });

      const levelRewards = await strapi.db
        .query("api::levelreward.levelreward")
        .findMany({
          where: {
            level: {
              $lt: user.level + 1,
            },
          },
        });

      // Reset User
      await strapi.service(CONFIG.API_PATH).resetUser(user);

      const populate = FUNCTIONS.makePopulate([
        "usercards.card",
        "artifacts",
        "claimed_artifacts",
        "avatar.image",
        "card_tickets",
        "shared_by",
        "shared_buddies.avatar.image",
      ]);

      const data = await STRAPI.getUser(user.id, populate);

      const userDataModified = {
        ...data,
        artifacts_count,
        cards_count,
        levelRewards,
      };
      return userDataModified;
    },

    async getRecommendedCards(ctx) {
      const { prioritize } = ctx.request.body;

      const user = await STRAPI.getUser(ctx.state.user.id);

      const usercards = await strapi.db
        .query("api::usercard.usercard")
        .findMany({
          where: {
            user: user.id,
          },
          populate: {
            card: {
              populate: {
                realm: true,
                image: true,
              },
            },
          },
        });

      let continueList = [];
      let newCardsList = [];

      const userPreferences = {
        isProMember: user.pro,
        favoriteCategories: user.tutorial?.favoriteCategories || [],
      };

      const sortCardsByScore = (cards, freshUnlockedCardsNoProgress) => {
        const cardScores = cards.map((card) => {
          const score =
            // give for open first
            (card.isOpen ? 1 : 0) +
            // if pro member give not pro cards
            (!userPreferences.isProMember && !card.type == "premium" ? 1 : 0) +
            //favorite realms
            (userPreferences.favoriteCategories.includes(card.realm?.id)
              ? 0.75
              : 0) +
            // unlocked cards but 0 progress
            (freshUnlockedCardsNoProgress.includes(card.id) ? 2 : 0);
          return { ...card, score };
        });

        const sortedCards = cardScores.sort((a, b) =>
          a.score === b.score ? Math.random() - 0.5 : b.score - a.score
        );
        return sortedCards;
      };
      const todayTimestamp = new Date().setHours(0, 0, 0, 0);
      if (prioritize === "program") {
        // 1. CONTINUE LIST
        continueList = usercards
          .filter(
            (usercard) =>
              usercard.completed > 0 &&
              usercard.completed < CONFIG.PROGRAM_COMPLETED_MAX &&
              new Date(usercard.completed_at).setHours(0, 0, 0, 0) !=
                todayTimestamp
          )
          // .sort((a, b) => b.completed - a.completed)
          .sort((a, b) => {
            // Sort by progress in descending order
            if (a.completed !== b.completed) {
              return b.completed - a.completed;
            }

            // If progress is the same, check favorite categories
            const aIsFavorite = userPreferences.favoriteCategories.includes(
              a.realm?.id
            );
            const bIsFavorite = userPreferences.favoriteCategories.includes(
              b.realm?.id
            );

            // Cards with favorite categories come first
            if (aIsFavorite !== bIsFavorite) {
              return aIsFavorite ? -1 : 1;
            }

            // If both have the same favorite status, no specific sorting within the same category
            return 0;
          })
          .map((usercard) => usercard.card);

        // 2. NEW CARDS LIST
        const cardsInProgress = usercards
          .filter((usercard) => usercard.completed > 0)
          .map((usercard) => usercard.card.id);

        const newCards = await strapi.db.query("api::card.card").findMany({
          // fields: ["id"],
          where: {
            id: {
              $notIn: cardsInProgress,
            },
          },
          populate: {
            realm: true,
            image: true,
          },
        });

        const freshUnlockedCardsNoProgramProgress = usercards
          .filter((usercard) => usercard.completed === 0)
          .map((usercard) => usercard.card.id);

        newCardsList = sortCardsByScore(
          newCards,
          freshUnlockedCardsNoProgramProgress
        );
      } else if (prioritize === "content") {
        const calculateTotalLevel = (relationCount) => {
          let totalLevel = 0;
          for (const [key, value] of Object.entries(relationCount)) {
            totalLevel += value;
          }
          return totalLevel;
        };
        // 1. CONTUNUE LIST
        continueList = usercards
          .filter(
            (usercard) =>
              usercard.level > 0 &&
              usercard.level < calculateTotalLevel(usercard.card.relationCount)
          )
          .sort((a, b) => {
            // Sorting by the number of timestamps equal to today
            const aProgressMap = a.progressMap || {};
            const bProgressMap = b.progressMap || {};

            const aTodayTimestamps = Object.values(aProgressMap).filter(
              (entry) =>
                entry.lastTime &&
                new Date(entry.lastTime).setHours(0, 0, 0, 0) === todayTimestamp
            ).length;

            const bTodayTimestamps = Object.values(bProgressMap).filter(
              (entry) =>
                entry.lastTime &&
                new Date(entry.lastTime).setHours(0, 0, 0, 0) === todayTimestamp
            ).length;

            if (aTodayTimestamps !== bTodayTimestamps) {
              return bTodayTimestamps - aTodayTimestamps;
            }

            if (a.level !== b.level) {
              return b.level - a.level;
            }

            // If timestamps are equal, sort by favorite category
            const aIsFavorite = userPreferences.favoriteCategories.includes(
              a.realm?.id
            );
            const bIsFavorite = userPreferences.favoriteCategories.includes(
              b.realm?.id
            );

            if (aIsFavorite !== bIsFavorite) {
              return aIsFavorite ? -1 : 1;
            }

            // If everything is equal, no specific sorting
            return 0;
          })
          .map((usercard) => usercard.card);

        // 2. NEW CARDS LIST
        const cardsInProgress = usercards
          .filter((usercard) => usercard.level > 0)
          .map((usercard) => usercard.card.id);

        const newCards = await strapi.db.query("api::card.card").findMany({
          // fields: ["id"],
          where: {
            id: {
              $notIn: cardsInProgress,
            },
          },
          populate: {
            realm: true,
            image: true,
          },
        });

        const freshUnlockedCardsNoContentProgress = usercards
          .filter((usercard) => usercard.level === 0)
          .map((usercard) => usercard.card.id);

        newCardsList = sortCardsByScore(
          newCards,
          freshUnlockedCardsNoContentProgress
        );
      } else if (prioritize === "progress") {
        function calculateTotalClaims(progressQuest) {
          let totalClaims = 0;

          for (const contentType in C_TYPES.CONTENT_MAP) {
            if (progressQuest.hasOwnProperty(contentType)) {
              const { max } = C_TYPES.CONTENT_MAP[contentType];
              const claims = Math.floor(
                progressQuest[contentType].progress / max
              );
              totalClaims += claims;
            }
          }

          return totalClaims;
        }
        // 1. CONTINUE LIST
        continueList = usercards
          .filter((usercard) => usercard.level > 0)
          .map((usercard) => {
            const totalClaims = calculateTotalClaims(usercard.progressQuest);
            return {
              card: usercard.card,
              totalClaims,
            };
          })
          // .sort((a, b) => b.totalClaims - a.totalClaims)
          .sort((a, b) => {
            if (a.totalClaims !== b.totalClaims) {
              return b.totalClaims - a.totalClaims;
            }

            const aIsFavorite = userPreferences.favoriteCategories.includes(
              a.realm?.id
            );
            const bIsFavorite = userPreferences.favoriteCategories.includes(
              b.realm?.id
            );

            if (aIsFavorite !== bIsFavorite) {
              return aIsFavorite ? -1 : 1;
            }

            return 0;
          })
          .map((usercard) => usercard.card);
      }

      const MAX_RECOMMENDED_CARDS = 10;
      continueList = continueList.slice(
        0,
        Math.min(continueList.length, MAX_RECOMMENDED_CARDS)
      );
      newCardsList = newCardsList.slice(
        0,
        Math.min(newCardsList.length, MAX_RECOMMENDED_CARDS)
      );

      return ctx.send({ continueList, newCardsList });
    },

    async claimObjective(ctx) {
      const objectiveId = ctx.request.body.objectiveId;

      const user = await STRAPI.getUser(ctx.state.user.id, { artifacts: true });
      const user_objectives = user.objectives_json || {};

      const objective = await strapi.db
        .query("api::objective.objective")
        .findOne({
          where: { id: objectiveId },
        });

      if (!objective) {
        ctx.throw(400, `This objective does not exist`);
      }
      if (
        !user_objectives[objective.id] &&
        objective.requirement !== TYPES.OBJECTIVE_REQUIREMENT_TYPES.login
      ) {
        ctx.throw(400, `This objective is not started yet!`);
      }
      if (
        user_objectives[objective.id].progress < objective.requirement_amount &&
        objective.requirement !== TYPES.OBJECTIVE_REQUIREMENT_TYPES.login
      ) {
        ctx.throw(400, `This objective is not completed yet!`);
      }

      if (objective.is_premium && !user.pro) {
        ctx.throw(400, `This objective requires a pro account!`);
      }

      // objectives trigger for daily/weekly
      const objectivesForNotification = await strapi
        .service(CONFIG.API_PATH)
        .objectivesTrigger(user, objective.time_type);

      // SAVE PROGRESS
      const updated_user_objectives = {
        ...user_objectives,
        [objective.id]: {
          isCollected: true,
          progress:
            objective.requirement !== TYPES.OBJECTIVE_REQUIREMENT_TYPES.login
              ? 0
              : 1,
        },
      };

      let payload = { objectives_json: updated_user_objectives };

      if (
        objective.requirement == TYPES.OBJECTIVE_REQUIREMENT_TYPES.login &&
        user.streak >= (user.highest_streak_count || 0)
      ) {
        payload = {
          objectives_json: updated_user_objectives,
          highest_streak_count: (user.highest_streak_count || 0) + 1,
        };
      }

      await STRAPI.updateUser(user.id, payload);

      // GAIN REWARDS SERVICE TRIGGER
      let objectiveRewards = await strapi
        .service(CONFIG.API_PATH)
        .gainObjectiveRewards(user, objective);

      // artifact trigger
      const artifact = await strapi
        .service(CONFIG.API_PATH)
        .achievementTrigger(user, TYPES.STATS_OPTIONS[objective.time_type]);

      if (artifact) {
        objectiveRewards.artifact = artifact;
      }

      return {
        rewards: objectiveRewards,
        // objectivesForNotification, maybe no reason to show for objectives because on same page
      };
    },

    async claimTutorialStep(ctx) {
      const user = await STRAPI.getUser(ctx.state.user.id);
      const tutorial = user.tutorial || {};
      const tutorialStep = ctx.request.body.tutorialStep;

      if (
        !tutorialStep ||
        tutorialStep < 0 ||
        tutorialStep > CONFIG.TUTORIAL_MAX_STEPS
      ) {
        return ctx.badRequest("Invalid Tutorial Step");
      }

      let upload;

      if (tutorialStep <= CONFIG.TUTORIAL_MAX_STEPS) {
        upload = {
          tutorial: {
            ...tutorial,
            step: tutorialStep + 1,
            progress: 0,
          },
        };
      } else {
        upload = {
          tutorial: {
            ...tutorial,
            step: -1,
            progress: -1,
            isComplete: true,
          },
        };
      }

      await STRAPI.updateUser(user.id, upload);
      return { rewards: { stars: CONFIG.STARS_FROM_TUTORIAL[step] } };
    },

    async claimCalendarReward(ctx) {
      const user = await STRAPI.getUser(ctx.state.user.id);
      let calendar = user.tutorial.calendar || {};

      const today = new Date();
      const daysSinceStart =
        Math.floor((today - calendar.startDate) / (1000 * 60 * 60 * 24)) + 1;

      if (daysSinceStart > 7) {
        calendar.isFinished = true;
        ctx.throw(
          400,
          "You can't claim any more rewards. The 7-day period has ended."
        );
      }

      if (daysSinceStart === 7) {
        calendar.claimed_days.push(7);
        calendar.isFinished = true;
      }

      if (calendar.claimed_days.includes(daysSinceStart)) {
        ctx.throw(400, "You've already claimed the reward for this day.");
      }

      calendar.claimed_days.push(daysSinceStart);

      upload = {
        tutorial: {
          ...tutorial,
          calendar: {
            ...calendar,
            claimed_days: calendar.claimed_days,
            startDate: calendar.startDate,
            isFinished: calendar.isFinished,
          },
        },
      };

      await STRAPI.updateUser(user.id, upload);
      return { rewards: { stars: CONFIG.STARS_FROM_CALENDAR[daysSinceStart] } };
    },

    async acceptReferral(ctx) {
      const user = await STRAPI.getUser(ctx.state.user.id, {
        shared_by: true,
        shared_buddies: true,
      });
      // update self
      if (user.is_referral_accepted) {
        ctx.throw(400, "You already claimed this reward");
      }

      const upload = {
        is_referral_accepted: true,
        stars: user.stars + CONFIG.STARS_REWARD_FROM_BUDDY_REWARD,
      };

      const sharedUserId = user.shared_by.id;

      const sharedUser = await STRAPI.getUser(sharedUserId, {
        shared_buddies: true,
      });

      if (!sharedUser) {
        ctx.throw(400, "No user shared by this user");
      }

      await STRAPI.updateUser(user.id, upload);

      // update the shared user
      const sharedUpload = {
        highest_buddy_shares: sharedUser.highest_buddy_shares + 1,
        shared_buddies: [...sharedUser.shared_buddies, sharedUserId],
      };

      await STRAPI.updateUser(sharedUserId, sharedUpload);
      return { rewards: { stars: CONFIG.STARS_REWARD_FROM_BUDDY_REWARD } };
    },

    async getRandomCard(ctx) {
      // 1. get all cards
      function extractCardsIds(usercards) {
        return usercards.map(({ card }) => card.id);
      }

      const user = await STRAPI.getUser(ctx.state.user.id, {
        usercards: {
          populate: {
            card: true,
          },
        },
      });

      const cards = await strapi.db.query("api::card.card").findMany({
        where: {
          $or: [
            {
              is_open: true,
            },
            {
              id: {
                // cardsOwnedByUser
                $in: extractCardsIds(user.usercards),
              },
            },
          ],
        },
      });

      function getRandomCard(cardArray) {
        const randomIndex = Math.floor(Math.random() * cardArray.length);
        return cardArray[randomIndex];
      }

      let randomCard = await strapi.db.query("api::card.card").findOne({
        where: { id: getRandomCard(cards).id },
        populate: true,
      });
      randomCard.createdBy = "";
      randomCard.updatedBy = "";
      return randomCard;
    },

    async submitTutorial(ctx) {
      const { favoriteRealms, friendCode } = ctx.request.body;
      const user = await STRAPI.getUser(ctx.state.user.id);
      const tutorial = user.tutorial || {};
      const upload = {
        ...(!user.shared_by && friendCode && { shared_by: friendCode }),
        tutorial: {
          ...tutorial,
          favoriteCategories: favoriteRealms,
          isCompleted: true,
        },
      };
      await STRAPI.updateUser(user.id, upload);
      return { success: true };
    },

    // SHOP
    async purchaseProduct(ctx) {
      const user = await STRAPI.getUser(ctx.state.user.id, {
        orders: {
          populate: {
            product: true,
          },
        },
      });

      const productId = ctx.request.body.productId;
      // const payment_env = ctx.request.body.payment_env;

      const payment_env = TYPES.PAYMENT_ENV_TYPES.ios;

      const product = await strapi.db.query("api::product.product").findOne({
        where: {
          id: productId,
        },
        populate: { bundle: true },
      });

      if (!product) {
        return ctx.badRequest("Product does not exist.");
      }

      // validation from PAYMENT GATEWAY - DELETE FAKE DATA
      const API = {
        status: "paid",
        amount: product.price,
        payment_env: payment_env,
      };

      //1. Android Validation
      if (payment_env === TYPES.PAYMENT_ENV_TYPES.android) {
        //validate purchase status -> API
        // if (okay) => go next, if not return error
      }

      //2. Ios Validation
      if (payment_env === TYPES.PAYMENT_ENV_TYPES.ios) {
        //validate purchase status -> API
        // if (okay) => go next, if not return error
      }

      //3. CASYS CPAY Validation
      if (payment_env === TYPES.PAYMENT_ENV_TYPES.cpay) {
        //validate purchase status -> API ???
        // if (okay) => go next, if not return error
      }

      if (!Object.values(TYPES.PAYMENT_ENV_TYPES).includes(payment_env)) {
        // Error: no environment or payment gateway
        return ctx.badRequest("No Payment Method");
      }

      // IF PAYMENT IS SUCCESSFUL -> EXECUTE LOGIC

      // IF PRODUCT === SUBSCRIPTION
      if (product.type === TYPES.PRODUCT_TYPES.subscription) {
        if (user.pro) {
          return ctx.badRequest("You already purchased pro.");
        }

        const starsAmountReward = product.bundle.filter(
          (bundle) => bundle.type === TYPES.PRODUCT_TYPES.stars
        )[0].quantity;

        const energyAmountRewards = product.bundle.filter(
          (bundle) => bundle.type === TYPES.PRODUCT_TYPES.energy
        )[0].quantity;

        STRAPI.updateUser(user.id, {
          pro: true,
          stars: user.stars + starsAmountReward,
          energy: energyAmountRewards,
          max_energy: energyAmountRewards,
        });

        await strapi.service(CONFIG.API_PATH).createOrder(user, product, API);

        const artifact = await strapi
          .service(CONFIG.API_PATH)
          .achievementTrigger(user, TYPES.STATS_OPTIONS.pro_buy);

        return { rewards: { artifact } };
      }

      // IF PRODUCT === STARS
      if (product.type === TYPES.PRODUCT_TYPES.stars) {
        const isFirstBonus = !user.stats[USER.DEFAULT_USER_STATS.first_bonus];

        const starsGained =
          user.stars + product.amount + isFirstBonus ? product.amount : 0;

        const upload = {
          stars: starsGained,
          stats: isFirstBonus
            ? { ...user.stats, first_bonus: true }
            : user.stats,
        };
        await STRAPI.updateUser(user.id, upload);

        await strapi.service(CONFIG.API_PATH).createOrder(user, product, API);

        const artifact = await strapi
          .service(CONFIG.API_PATH)
          .achievementTrigger(user, TYPES.STATS_OPTIONS.purchases_made);

        return { rewards: { artifact } };
      }

      // IF PRODUCT === ENERGY
      if (product.type === TYPES.PRODUCT_TYPES.energy) {
        const isFirstBonus = !user.stats[USER.DEFAULT_USER_STATS.first_bonus];
        await strapi.service(CONFIG.API_PATH).createOrder(user, product, API);

        const upload = {
          energy:
            user.energy + product.amount + isFirstBonus ? product.amount : 0,
          stats: isFirstBonus
            ? { ...user.stats, first_bonus: true }
            : user.stats,
        };
        await STRAPI.updateUser(user.id, upload);

        const artifact = await strapi
          .service(CONFIG.API_PATH)
          .achievementTrigger(user, TYPES.STATS_OPTIONS.purchases_made);

        return { rewards: { artifact } };
      }

      // IF PRODUCT === BUNDLE
      // if (product.type === TYPES.PRODUCT_TYPES.bundle) {
      //   const hasBundle =
      //     user.orders.filter((order) => order.product.id === product.id)
      //       .length > 0;

      //   if (hasBundle) {
      //     return ctx.badRequest("You have already purchased this bundle.");
      //   }

      //   for (let i = 0; i < product.bundle.length; i++) {
      //     await strapi
      //       .service(CONFIG.API_PATH)
      //       .gainReward(
      //         user,
      //         product.bundle[i].type,
      //         product.bundle[i].quantity
      //       );
      //   }

      //   const newOrder = await strapi
      //     .service(CONFIG.API_PATH)
      //     .createOrder(user, product, API);

      //   // BUNDLE_PURCHASE_SUCCESS
      //   return newOrder;
      // }
    },

    async notifyMe(ctx) {
      const user = await STRAPI.getUser(ctx.state.user.id);
      const isNotifyMe = ctx.request.body.isNotifyMe;
      if (typeof isNotifyMe !== "boolean") {
        ctx.throw(400, "invalid input, must be boolean");
      }
      const upload = {
        is_notify_me: isNotifyMe,
      };

      await STRAPI.updateUser(user.id, upload);
      return { success: true };
    },

    // PROFILE
    async collectStreakReward(ctx) {
      const user = await STRAPI.getUser(ctx.state.user.id, {
        artifacts: true,
      });

      const streakCount = ctx.request.body.rewardCount;
      const streakReward = await strapi.db
        .query("api::streakreward.streakreward")
        .findOne({
          where: { streak_count: streakCount },
          populate: {
            reward_card: {
              populate: {
                image: true,
                realm: true,
              },
            },
            artifact: true,
          },
        });

      let userRewards = user.streak_rewards || {};

      if (!streakReward) {
        return ctx.badRequest("This streak reward does not exist.");
      }

      if ((user.highest_streak_count || 0) < streakReward.streak_count) {
        return ctx.badRequest(
          "Your streak is not high enough yet to unlock this reward."
        );
      }

      if (userRewards[streakReward.streak_count]) {
        ctx.throw(400, `You have already claimed this reward.`);
      }

      // SAVE PROGRESS
      userRewards = { ...userRewards, [streakReward.streak_count]: true };

      const upload = {
        streak_rewards: userRewards,
      };

      await STRAPI.updateUser(user.id, upload);
      // GAIN REWARDS SERVICE TRIGGER

      let rewards = {};

      // GAIN STARS
      if (streakReward.reward_type === TYPES.STREAK_REWARD_TYPES.stars) {
        await strapi
          .service(CONFIG.API_PATH)
          .gainReward(
            user,
            TYPES.STREAK_REWARD_TYPES.stars,
            streakReward.reward_amount
          );
        rewards.stars = streakReward.reward_amount;
      }

      // GAIN CARD
      if (streakReward.reward_card) {
        const gainCardResponse = await strapi
          .service(CONFIG.API_PATH)
          .gainCard(ctx, streakReward.reward_card);

        rewards.card = gainCardResponse.card;
        rewards.usercard = { ...gainCardResponse.usercard, card: rewards.card }; // because card is not populated on usercard

        return { rewards };
      }

      // GAIN ARTIFACT
      if (streakReward.artifact) {
        rewards.artifact = await strapi
          .service(CONFIG.API_PATH)
          .gainArtifact(user, streakReward.artifact.id);
      }
      return { rewards };
    },

    async collectFriendsReward(ctx) {
      // static data
      const user = await STRAPI.getUser(ctx.state.user.id, {
        artifacts: true,
      });

      const friendsCount = ctx.request.body.userCount;

      const friendsReward = await strapi.db
        .query("api::friendreward.friendreward")
        .findOne({
          where: { friends_count: friendsCount },
          populate: {
            reward_card: {
              populate: {
                image: true,
                realm: true,
              },
            },
            artifact: true,
          },
        });

      let userRewards = user.friends_rewards || {};

      if (!friendsReward) {
        return ctx.badRequest("This friend reward does not exist.");
      }

      if (user.highest_buddy_shares.length < friendsReward.friends_count) {
        return ctx.badRequest(
          "You don't have enough connected buddies yet to unlock this reward."
        );
      }

      if (userRewards[friendsReward.friends_count]) {
        ctx.throw(400, `You have already claimed this reward.`);
      }

      // SAVE PROGRESS
      userRewards = { ...userRewards, [friendsReward.friends_count]: true };

      const upload = {
        friends_rewards: userRewards,
        stars: user.stars + CONFIG.STARS_REWARD_FROM_BUDDY_REWARD,
      };

      await STRAPI.updateUser(user.id, upload);

      let rewards = {
        stars: CONFIG.STARS_REWARD_FROM_BUDDY_REWARD,
      };

      // GAIN CARD
      if (friendsReward.reward_card) {
        const gainCardResponse = await strapi
          .service(CONFIG.API_PATH)
          .gainCard(ctx, friendsReward.reward_card);

        rewards.card = gainCardResponse.card;
        rewards.usercard = { ...gainCardResponse.usercard, card: rewards.card }; // because card is not populated on usercard

        return { rewards };
      }

      // GAIN REWARDS SERVICE TRIGGER
      if (friendsReward.artifact) {
        rewards.artifact = await strapi
          .service(CONFIG.API_PATH)
          .gainArtifact(user, friendsReward.artifact.id);
      }

      return { rewards };
    },

    async collectLevelReward(ctx) {
      // static data
      const user = await STRAPI.getUser(ctx.state.user.id, {
        artifacts: true,
      });

      const levelId = ctx.request.body.id;

      const levelReward = await strapi.db
        .query("api::levelreward.levelreward")
        .findOne({
          where: { id: levelId },
          populate: {
            reward_card: {
              populate: {
                image: true,
                realm: true,
              },
            },
            artifact: true,
          },
        });

      let userRewards = user.rewards_tower || {};

      if (!levelReward) {
        return ctx.badRequest("This level reward does not exist.");
      }

      if (user.level < levelReward.level) {
        return ctx.badRequest(
          "You are not high enough level yet to unlock this reward."
        );
      }

      if (!user.pro && levelReward.is_premium) {
        return ctx.badRequest("You need pro account to unlock this reward.");
      }

      if (userRewards[levelReward.id]) {
        ctx.throw(400, `You have already claimed this reward.`);
      }

      // SAVE PROGRESS
      userRewards = { ...userRewards, [levelReward.id]: true };

      const upload = {
        rewards_tower: userRewards,
      };

      const data = await STRAPI.updateUser(user.id, upload);

      // GAIN ARTIFACT IF THERE IS ONE

      let rewards = {};

      // GAIN CARD
      if (levelReward.card) {
        const gainCardResponse = await strapi
          .service(CONFIG.API_PATH)
          .gainCard(ctx, levelReward.card);

        rewards.card = gainCardResponse.card;
        rewards.usercard = { ...gainCardResponse.usercard, card: rewards.card }; // because card is not populated on usercard

        return { rewards };
      }

      if (levelReward.artifact) {
        rewards.artifact = await strapi
          .service(CONFIG.API_PATH)
          .gainArtifact(user, levelReward.artifact.id);
      }

      // GAIN REWARDS SERVICE TRIGGER
      if (!levelReward.artifact && !levelReward.reward_card) {
        const rewardType = levelReward.reward_type;
        const quantity = levelReward.reward_amount;

        await strapi
          .service(CONFIG.API_PATH)
          .gainReward(user, rewardType, quantity);
        rewards[levelReward.reward_type] = quantity;
      }

      return {
        rewards: rewards,
      };
    },

    async claimArtifact(ctx) {
      const artifactId = ctx.request.body.artifactId;
      const user = await STRAPI.getUser(ctx.state.user.id, {
        artifacts: true,
        claimed_artifacts: true,
      });

      const hasArtifact =
        user.artifacts.filter((a) => parseInt(a.id) == parseInt(artifactId))
          .length > 0;

      if (!hasArtifact) {
        ctx.throw(400, "You dont own this artifact.");
      }

      const alreadyClaimed =
        user.claimed_artifacts.filter(
          (a) => parseInt(a.id) == parseInt(artifactId)
        ).length > 0;

      if (alreadyClaimed) {
        ctx.throw(400, "You have already claimed this artifact.");
      }

      console.log(user.stats);

      let upload = {
        claimed_artifacts: [...user.claimed_artifacts, artifactId],
        stats: {
          ...user.stats,
          claimed_artifacts: user.stats.claimed_artifacts + 1,
        },
      };

      console.log(upload);

      await STRAPI.updateUser(user.id, upload, { claimed_artifacts: true });

      const artifact = await strapi.entityService.findOne(
        `api::artifact.artifact`,
        artifactId,
        {
          populate: { image: true },
        }
      );
      return artifact;
    },

    async saveAvatar(ctx) {
      const user = await STRAPI.getUser(ctx.state.user.id);
      const avatarId = ctx.request.body.avatarId;

      const avatar = await strapi.db.query("api::avatar.avatar").findOne({
        where: {
          id: avatarId,
        },
        populate: {
          image: true,
        },
      });

      if (!avatar) {
        ctx.throw(400, "Avatar Image does not exist.");
      }

      // check if he can equip avatar ->
      const upload = {
        avatar: avatar.id,
      };
      await STRAPI.updateUser(user.id, upload);
      return avatar;
    },

    // SETTINGS
    async claimFaq(ctx) {
      const { id } = ctx.request.body;
      const user = await STRAPI.getUser(ctx.state.user.id);
      const faqRewards = user.faq_rewards || [];
      const faq = strapi.query("api::faq.faq").findOne({ id });

      if (!faq) {
        ctx.throw(400, "This faq does not exist.");
      }

      if (faqRewards.includes(id)) {
        ctx.throw(400, "You have already claimed this faq.");
      }

      const upload = {
        faq_rewards: [...faqRewards, id],
        stars: user.stars + CONFIG.STARS_REWARD_FROM_FAQ,
        stats: {
          ...user.stats,
          faqs_claimed: user.stats.faqs_claimed
            ? user.stats.faqs_claimed + 1
            : 1,
        },
      };

      await STRAPI.updateUser(user.id, upload);
      return { rewards: { stars: CONFIG.STARS_REWARD_FROM_FAQ } };
    },
    async updateEmailSettings(ctx) {
      const user = await STRAPI.getUser(ctx.state.user.id);
      const { settings } = ctx.request.body;
      // Validate the email_preferences object

      if (typeof settings !== "object" || settings === null) {
        ctx.throw(400, "Invalid email preferences object");
      }

      // Check if the keys in email_preferences are valid
      for (const key in settings) {
        if (!TYPES.NOTIFICATION_KEYS.includes(key)) {
          ctx.throw(400, `Invalid email preferences key: ${key}`);
        }
      }

      // Check if the values are booleans
      for (const key in settings) {
        if (typeof settings[key] !== "boolean") {
          ctx.throw(400, `Invalid value for email preference: ${key}`);
        }
      }

      const payload = {
        settings: settings,
      };

      await STRAPI.updateUser(user.id, payload);

      return { success: true };
    },

    async updateUserBasicInfo(ctx) {
      const user = await STRAPI.getUser(ctx.state.user.id);
      const { value, inputName } = ctx.request.body;

      if (!TYPES.SETTINGS_BASICINFO_TYPES.includes(inputName)) {
        ctx.throw(400, "invalid input");
      }

      const payload = {
        [inputName]: value,
      };
      await STRAPI.updateUser(user.id, payload);
      return { success: true };
    },

    async sendFeatureMail(ctx) {
      const { details, subject } = ctx.request.body;

      // Check if user has exceeded suggestion limit for the day
      const user = ctx.state.user;
      const name = user.username;
      const email = user.email;

      const suggestionLimit = CONFIG.MAX_USER_FEEDBACK;

      const suggestionCount = user.mail_send_count || 0;

      if (suggestionCount >= suggestionLimit) {
        return ctx.badRequest(
          `You have exceeded the suggestion limit of ${suggestionLimit}. Please contact us at our email ${CONFIG.EMAIL} if you wish this limit to reset.`
        );
      }

      // Send email with user's input details using SendGrid API

      await strapi.plugins["email"].services.email.send({
        to: CONFIG.EMAIL,
        subject: subject || CONFIG.DEFAULT_SUBJECT,
        text: `Name: ${name}\nEmail: ${email}\nDetails: ${details}`,
      });

      // Update user's suggestion count and last suggestion date
      const upload = {
        mail_send_count: suggestionCount + 1,
      };
      await STRAPI.updateUser(user.id, upload);

      // Return success message
      return {
        message: "Feature suggestion or bug report submitted successfully.",
      };
    },

    async deleteAccount(ctx) {
      const userId = ctx.state.user.id;

      //delete all usercards WARNING!!!
      // WORKAROUND FOR STRAPI QUERY FIRST (find all) THEN DELETE (delete many) -> https://github.com/strapi/strapi/issues/11998

      const toDelete = await strapi.db
        .query(CONFIG.API_PATH)
        .findMany({ where: { user: userId } });

      await strapi.db
        .query(CONFIG.API_PATH)
        .deleteMany({ where: { id: { $in: toDelete.map(({ id }) => id) } } });

      await strapi.db
        .query("plugin::users-permissions.user")
        .delete({ where: { id: userId } });

      return { message: "Account deleted" };
    },
  })
);
