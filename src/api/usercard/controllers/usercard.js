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
        contentType in C_TYPES.MAX_PROGRESS_PER_C_TYPE ? true : false;

    console.log(action, contentType, contentTypeId, cardId);

      const formattedContentType = C_TYPES.singularize(contentType);
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

    console.log(user.username);

    const contentTypeIdParsed = parseInt(contentTypeId);

    const isValidContentType = (contentType) =>
      contentType in maxProgressPerContentType ? true : false;

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

    const formattedContentType = singularize(contentType);
    const contentTypeData =
      action == "claim"
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

    let userCard = await getOrCreateUserCard(ctx, card);

        const userData = STRAPI.updateUser(user.id, userUpdate);

    if (!progressMap[contentType]) {
      progressMap[contentType] = {};
    }

    if (!progressMap[contentType][contentTypeId]) {
      if (contentTypeData.isOpen) {
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
        // const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        // if (
        //   Date.now() -
        //     userCard.progressMap[contentType][contentTypeId].lastTime <
        //   oneDay
        // ) {
        //   return ctx.throw(
        //     400,
        //     "You need to wait 24 hours before updating progress again."
        //   );
        // }

        // check energy
        if (user.energy < 1) {
          return ctx.throw(400, "You don't have enough energy.");
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

        if (
          progressMap[contentType][contentTypeId].completed <
          C_TYPES.MAX_PROGRESS_PER_C_TYPE[contentType]
        ) {
          progressMap[contentType][contentTypeId] = {
            completed: progressMap[contentType][contentTypeId].completed + 1,
            lastTime: Date.now(),
          };
        } else {
          ctx.throw(400, "You have already completed this content type.");
        }

        // update the PROGRESSQUEST

        // Initialize progressQuest if it's not defined
        // let progressQuest = userCard.progressQuest ?? {};
        let progressQuest =
          userCard.progressQuest == null ? {} : userCard.progressQuest;
        progressQuest[contentType] =
          progressQuest[contentType] ?? C_TYPES.DEFAULT_PROGRESS_QUEST;

        // Check if progress is already at the maximum for this contentType
        if (
          progressQuest[contentType].progress + 1 ==
          C_TYPES.MAX_PROGRESS_PER_C_TYPE[contentType]
        ) {
          // If progress is at maximum, reset progress to 1 and increment level
          // progressQuest[contentType].progress = 0;
          // progressQuest[contentType].level++;
          progressQuest[contentType].claimsAvailable++;
        }
        progressQuest[contentType].progress++;

        userCard = await strapi.db.query(CONFIG.API_PATH).update({
          where: { id: userCard.id },
          data: {
            progressMap,
            progressQuest,
          },
        });

        await strapi
          .service(CONFIG.API_PATH)
          .objectivesTrigger(user, TYPES.OBJECTIVE_TRIGGERS.energy);

        // ACHIEVEMENTS UPDATE?? @TODO

        ctx.send(userCard);
      }
    }

      if (action == API_ACTIONS.updateContentType.claim) {
        let progressQuest = userCard.progressQuest;

        if (!progressQuest) {
          return ctx.throw(400, "You have not completed any content yet.");
        }
        if (progressQuest[contentType].claimsAvailable < 1) {
          return ctx.throw(400, "You have already claimed this quest.");
        }
        // claim quest
        progressQuest[contentType].claimsAvailable--;
        progressQuest[contentType].level++;
        progressQuest[contentType].progress =
          progressQuest[contentType].progress -
          C_TYPES.MAX_PROGRESS_PER_C_TYPE[contentType];

        // ROLL RANDOM CONTENT TYPE
        const randomReward = await strapi
          .service(CONFIG.API_PATH)
          .getRandomUndroppedContent(ctx, user);

        const { reward, rewardType, error } = randomReward;
        if (error) {
          ctx.throw(400, "No rewards available.");
        }

        const formattedContentType = C_TYPES.singularize(rewardType);

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
      } else {
        newSavedContent.push(contentTypeIdParsed);
      }

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


      // BOOKMARK IN PROGRESSMAP IN USERCARD

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

        return {
          rewards: {
            stars: CONFIG.XP_FROM_QUEST,
            xp: xpRewards,
            content: { ...reward, type: rewardType },
            cardMeta: cardFromReward.card,
          },
        };
      }

    // fix update/program
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

      return userCardWithCard;
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
        energy: user.energy - 1,
      };

      await STRAPI.updateUser(user.id, upload);
      return { ...usercard, card: { id: card_id } };
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

      const usercard = await STRAPI.STRAPI.getUserCard(user.id, cardId);

      if (!usercard) {
        ctx.throw(400, "invalid card, you don't have this card unlocked yet");
      }
      // IF RATING
      if (feedbackType === TYPES.FEEDBACK_TYPES.rating) {
        if (typeof rating !== "number" && !availableRatings.includes(rating)) {
          ctx.throw(400, "invalid input, must be proper rating number");
        }
        upload = {
          rating: rating,
        };
      }
      // IF MESSAGE
      if (feedbackType === TYPES.FEEDBACK_TYPES.message) {
        upload = {
          message: rating,
          isRated: true,
        };
      } else {
        ctx.throw(400, "You have already completed this content type.");
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


      if (!progressMapFromReward[rewardType]) {
        progressMapFromReward[rewardType] = {};
      }

      // STRAPI.testFind();

      const artifacts_count = await strapi.db
        .query("api::artifact.artifact")
        .count();

      strapi.entityService.update(API_PATH, usercardFromReward.id, {
        data: {
          progressMap: progressMapFromReward,
        },
      });

      // UPDATE DROPPEDCONTENT JSON IN USER ->
      const droppedContent = user.droppedContent || {};

      // Reset User
      const today = new Date();
      const isRestarted = FUNCTIONS.formatDate(today) === user.reset_date;
      if (!isRestarted) {
        await strapi.service(CONFIG.API_PATH).resetUser(user, today);
      }

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

      //   shared_buddies: {
      //     populate: {
      //       avatar: {
      //         populate: {
      //           image: true,
      //         },
      //       },
      //     },
      //   },

      const userDataModified = {
        ...data,
        artifacts_count,
        cards_count,
        levelRewards,
      };
      return userDataModified;
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

      if (objective.is_premium && !user.is_subscribed) {
        ctx.throw(400, `This objective requires a premium subscription`);
      }

      // objectives trigger for daily/weekly
      await strapi
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
    }
    // IF MESSAGE
    if (feedbackType === "message") {
      upload = {
        message: rating,
        isRated: true,
      };
    }

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
      const objectiveRewards = await strapi
        .service(CONFIG.API_PATH)
        .gainObjectiveRewards(user, objective);

      // artifact trigger
      await strapi
        .service(CONFIG.API_PATH)
        .achievementTrigger(user, TYPES.ARTIFACT_TRIGGERS[objective.time_type]);

      return {
        rewards: objectiveRewards,
      };
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

    async updateTutorial(ctx) {
      const user = await STRAPI.getUser(ctx.state.user.id);

      const tutorialStep = ctx.request.body.tutorialStep;

      if (
        !tutorialStep ||
        tutorialStep < 0 ||
        tutorialStep > CONFIG.TUTORIAL_MAX_STEPS
      ) {
        return ctx.badRequest("Invalid Tutorial Step");
      }
      const upload = {
        tutorial_step: tutorialStep,
      };

      const data = await STRAPI.updateUser(user.id, upload);
      return data.tutorial_step;
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

      const productId = ctx.request.body.id;

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
        amount: product.amount,
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
        if (user.is_subscribed) {
          return ctx.badRequest("You are already subscribed.");
        }

        const upload = {
          is_subscribed: true,
          subscription_date: Date.now(),
        };

        const updatedUser = STRAPI.updateUser(user.id, upload);

        const newOrder = await strapi
          .service(CONFIG.API_PATH)
          .createOrder(user, product, API);

        const data = {
          newOrder,
          is_subscribed: updatedUser.is_subscribed,
        };

        // SUBSCRIPTION_PURCHASE_SUCCESS
        return data;
      }

      // IF PRODUCT === STARS
      if (product.type === TYPES.PRODUCT_TYPES.stars) {
        const newOrder = await strapi
          .service(CONFIG.API_PATH)
          .createOrder(user, product, API);

        const upload = { gems: user.gems + product.amount };
        await STRAPI.updateUser(user.id, upload);

        const data = {
          newOrder,
          gems: user.gems + product.amount,
        };
        return data;
        // "GEMS_PURCHASE_SUCCESS"
      }

      // IF PRODUCT === BUNDLE
      if (product.type === TYPES.PRODUCT_TYPES.bundle) {
        const hasBundle =
          user.orders.filter((order) => order.product.id === product.id)
            .length > 0;

        if (hasBundle) {
          return ctx.badRequest("You have already purchased this bundle.");
        }

        for (let i = 0; i < product.bundle.length; i++) {
          await strapi
            .service(CONFIG.API_PATH)
            .gainReward(
              user,
              product.bundle[i].type,
              product.bundle[i].quantity
            );
        }

        const newOrder = await strapi
          .service(CONFIG.API_PATH)
          .createOrder(user, product, API);

        // BUNDLE_PURCHASE_SUCCESS
        return newOrder;
      }
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
    }

    await updateUser(user.id, payload);

    // GAIN REWARDS SERVICE TRIGGER
    const objectiveRewards = await strapi
      .service(API_PATH)
      .gainObjectiveRewards(user, objective);

    // artifact trigger
    await strapi
      .service(API_PATH)
      .achievementTrigger(
        user,
        objective.time_type === "daily"
          ? "daily_objectives_complete"
          : "weekly_objectives_complete"
      );

    return {
      rewards: objectiveRewards,
    };
  },

  async acceptReferral(ctx) {
    const user = await getUser(ctx.state.user.id, { shared_by: true });
    // update self
    if (user.is_referral_accepted) {
      ctx.throw(400, "You already claimed this reward");
    }
    const upload = {
      is_referral_accepted: true,
      stars: user.stars + STARS_REWARD_FROM_BUDDY_REWARD,
    };

    const sharedUserId = user.shared_by.id;

    const sharedUser = await getUser(sharedUserId, { shared_buddies: true });

    if (!sharedUser) {
      ctx.throw(400, "No user shared by this user");
    }

    await updateUser(user.id, upload);

    // update the shared user
    const sharedUpload = {
      highest_buddy_shares: sharedUser.highest_buddy_shares + 1,
      // shared_buddies: [...sharedUser.shared_buddies, sharedUserId],
    };

    await updateUser(sharedUserId, sharedUpload);
    return { success: true };
  },

  async getRandomCard(ctx) {
    // 1. get all cards
    function extractCardsIds(usercards) {
      return usercards.map(({ card }) => card.id);
    }

    const user = await getUser(ctx.state.user.id, {
      usercards: {
        populate: {
          card: true,
        },
      },
    });

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


    const productId = ctx.request.body.id;

    // const payment_env = ctx.request.body.payment_env;
    const payment_env = "apple";

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
      amount: product.amount,
      payment_env: payment_env,
    };

    //1. Android Validation
    if (payment_env === "android") {
      //validate purchase status -> API
      // if (okay) => go next, if not return error
    }

    //2. Apple Validation
    if (payment_env === "apple") {
      //validate purchase status -> API
      // if (okay) => go next, if not return error
    }

    //3. CASYS CPAY Validation
    if (payment_env === "cpay") {
      //validate purchase status -> API ???
      // if (okay) => go next, if not return error
    }

    if (
      payment_env !== "android" &&
      payment_env !== "apple" &&
      payment_env !== "cpay"
    ) {
      //error no environment or payment gateway
      return ctx.badRequest("No Payment Method");
    }

    // IF PAYMENT IS SUCCESSFUL -> EXECUTE LOGIC

    // IF PRODUCT === SUBSCRIPTION
    if (product.type === "subscription") {
      if (user.is_subscribed) {
        return ctx.badRequest("You are already subscribed.");
      }

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


      // SUBSCRIPTION_PURCHASE_SUCCESS
      return data;
    }

    // IF PRODUCT === STARS
    if (product.type === "gems") {
      const newOrder = await strapi
        .service(API_PATH)
        .createOrder(user, product, API);

      const upload = { gems: user.gems + product.amount };
      await updateUser(user.id, upload);

      const upload = {
        rewards_tower: userRewards,

      };
      return data;
      // "GEMS_PURCHASE_SUCCESS"
    }

      const data = await STRAPI.updateUser(user.id, upload);

      // GAIN ARTIFACT IF THERE IS ONE

      let rewards = {};

      // GAIN CARD
      if (levelReward.reward_card) {
        const gainCardResponse = await strapi
          .service(CONFIG.API_PATH)
          .gainCard(ctx, levelReward.reward_card);

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

    async cancelSubscription(ctx) {
      const user = await STRAPI.getUser(ctx.state.user.id);


    let upload;
    const userFollowers = user.followers;
    const hasFollower =
      userFollowers.filter((f) => f.id === buddyId).length > 0;

    if (hasFollower) {
      const newFollowers = userFollowers
        .map((f) => f.id)
        .filter((i) => i !== buddyId);
      upload = {
        followers: newFollowers,
      };
    } else {
      upload = { followers: [...user.followers, buddyId] };
    }

      const upload = { is_subscription_cancelled: true };
      const data = await STRAPI.updateUser(user.id, upload);
      return data.is_unsubscribed;
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

