"use strict";
const fs = require("fs");
const path = require("path");

const {
  CONFIG,
  C_TYPES,
  USER,
  TYPES,
  API_ACTIONS,
} = require("../../../../utils/constants.js");

const { FUNCTIONS, STRAPI } = require("../../../../utils/functions.js");

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService(CONFIG.API_PATH, ({ strapi }) => ({
  sendEmailTemplate: async (
    template = "welcome-email",
    { email, username }
  ) => {
    const emailTemplate = {
      subject: "Welcome <%= user.username %>",
      text: `Welcome to mywebsite.fr!
        Your account is now linked with: <%= user.email %>.`,
      html: fs.readFileSync(
        path.join(
          __dirname,
          `../../../extensions/email/templates/${template}.html`
        ),
        "utf8"
      ),
    };

    await strapi.plugins["email"].services.email.sendTemplatedEmail(
      {
        to: email,
      },
      emailTemplate,
      {
        user: { username: username, email: email },
      }
    );

    return { success: true };
  },
  // reset-user on daily/weekly basis
  resetUser: async (user) => {
    const today = new Date();
    const isDailyResetComplete =
      FUNCTIONS.formatDate(today) === user.reset_date;

    // update last loggin anyway
    await STRAPI.updateUser(user.id, {
      tutorial: { ...user.tutorial, last_login: Date.now() },
    });

    //reset streak
    const hoursSinceLastLogin =
      (Date.now() - user.tutorial.last_login) / (1000 * 60 * 60);
    if (hoursSinceLastLogin >= 24) {
      await STRAPI.updateUser(user.id, {
        streak: 0,
      });
    }

    const { resetWeekDate, shouldWeekRestart } = FUNCTIONS.calculateWeekReset(
      user,
      today
    );

    if (!isDailyResetComplete) {
      await STRAPI.updateUser(user.id, {
        energy: user.energy <= user.max_energy ? user.max_energy : user.energy,
        reset_date: FUNCTIONS.formatDate(today),
        card_tickets: [],
        objectives_json: await FUNCTIONS.resetUserObjectives(
          user.objectives_json,
          TYPES.OBJECTIVE_TIME_TYPES.daily
        ),
      });
    }

    if (shouldWeekRestart) {
      await STRAPI.updateUser(user.id, {
        reset_week_date: resetWeekDate,
        objectives_json: await FUNCTIONS.resetUserObjectives(
          user.objectives_json,
          TYPES.OBJECTIVE_TIME_TYPES.weekly
        ),
      });
    }
  },

  gainXp: async (user, xp) => {
    let payload = {};
    const xpGained = xp ? xp : CONFIG.XP_FROM_QUEST;
    const xpLimit = FUNCTIONS.getXpLimit(user.level);

    const isLevelnew = user.xp + xpGained >= xpLimit;

    if (isLevelnew) {
      payload = {
        xp: user.xp + xpGained - xpLimit,
        level: user.level + 1,
        xpLimit: FUNCTIONS.getXpLimit(user.level + 1),
      };
    } else {
      payload = {
        xp: user.xp + xpGained,
      };
    }

    await STRAPI.updateUser(user.id, payload);

    return {
      xp: payload.xp,
      xpGained: xpGained,
      level: isLevelnew ? user.level + 1 : user.level,
      xpLimit: isLevelnew ? FUNCTIONS.getXpLimit(user.level + 1) : xpLimit,
      isLevelnew,
    };

    // NOT FINISHED
  },

  gainObjectiveRewards: async (user, objective) => {
    let payload = {};
    let artifact = false;
    let starsGained; // for return to frontend only

    const xpGained = CONFIG.XP_PER_OBJECTIVE[objective.time_type];

    const xpRewards = await strapi
      .service(CONFIG.API_PATH)
      .gainXp(user, xpGained);

    //1.5 Streak (objective reward = streak)
    if (objective.reward_type === TYPES.OBJECTIVE_REWARD_TYPES.streak) {
      payload = {
        ...payload,
        streak: user.streak + 1,
      };
    }

    //2. Objective reward = stars or lootbox
    if (objective.reward_type === TYPES.OBJECTIVE_REWARD_TYPES.stars) {
      payload = {
        ...payload,
        stars: user.stars + objective.reward_amount,
      };
      starsGained = objective.reward_amount;
    }

    //3. if lootbox - add stars + artifact %
    if (objective.reward_type === TYPES.OBJECTIVE_REWARD_TYPES.loot) {
      //3.1. gain random stars
      const randomStars = FUNCTIONS.getRandomStars();
      payload = {
        ...payload,
        stars: user.stars + randomStars,
      };
      starsGained = randomStars;

      const chanceToGainArtifact = CONFIG.CHANCE_TO_GAIN_ARTIFACT;
      const randomInt = Math.random();
      const shouldGainArtifact = randomInt <= chanceToGainArtifact;

      if (shouldGainArtifact) {
        artifact = await strapi
          .service("api::usercard.usercard")
          .gainArtifact(user, 0, true);
      }
    }
    await STRAPI.updateUser(user.id, payload);

    return {
      xp: xpRewards,
      stars: starsGained,
      artifact: artifact,
    };
  },

  gainReward: async (user, rewardType, quantity) => {
    const payload = {
      [rewardType]: user[rewardType] + quantity,
    };
    const data = await STRAPI.updateUser(user.id, payload);
    return {
      rewardType: rewardType,
      quantity: data[rewardType],
    };
  },

  gainArtifact: async (user, artifact_id, isRandom = false) => {
    let artifactId = artifact_id;
    let rewardArtifact = false;
    if (isRandom) {
      //craft random artifact
      const artifactsByRarity = await strapi.db
        .query("api::artifact.artifact")
        .findMany({
          where: {
            rarity: FUNCTIONS.determineRarity(),
            type: "random",
          },
          populate: {
            image: true,
          },
        });

      const userArtifactsById = user.artifacts.map((a) => a.id);

      const notDiscoveredArtifacts = artifactsByRarity.filter((a) => {
        if (!userArtifactsById.includes(a.id)) {
          return a;
        }
      });

      if (notDiscoveredArtifacts.length == 0) {
        // nemna vekje od toj rarity artifacti?
        return false;
      }
      //2. generate random number between 0 and cards.length
      const randomId = Math.floor(
        Math.random() * notDiscoveredArtifacts.length
      );
      //3. get that artifact -> add to artifacts collection
      rewardArtifact = notDiscoveredArtifacts[randomId];
      artifactId = rewardArtifact.id;
    }

    // GENERIC GAIN ARTIFACT

    const hasArtifact =
      user.artifacts.filter((a) => a.id === artifactId).length > 0;

    if (hasArtifact) {
      return false;
      // return ctx.badRequest("You already have that artifact");
    }

    const upload = { artifacts: [...user.artifacts, artifactId] };

    await STRAPI.updateUser(user.id, upload, { artifacts: true });

    const artifact = await strapi.db.query("api::artifact.artifact").findOne({
      where: {
        id: artifactId,
      },
      populate: {
        image: true,
      },
    });

    return artifact;
  },

  createOrder: async (user, product, API) => {
    const newOrder = await strapi.db.query("api::order.order").create({
      data: {
        user: user.id,
        product: product.id,
        amount: API.amount,
        status: API.status,
        payment_env: API.payment_env,
      },
    });

    return newOrder;
  },

  updateCard: async (user, card_id, action, ctx) => {
    const card = await strapi.db.query("api::card.card").findOne({
      where: {
        id: card_id,
      },
      populate: {
        days: {
          populate: {
            contents: true,
          },
        },
      },
    });

    if (!card) {
      return ctx.throw(400, `Card not found`);
    }

    // 1 ======= UNLOCK A CARD
    if (action === API_ACTIONS.updateCard.unlock) {
      const canUnlock = user.stars >= card.cost;
      if (!canUnlock) {
        return ctx.throw(
          400,
          `You do not have enough stars to unlock this card.`
        );
      }

      const usercard = await STRAPI.getOrCreateUserCard(ctx, card, true);

      const payload = {
        stars: user.stars - card.cost,
      };

      await STRAPI.updateUser(user.id, payload);

      const artifact = await strapi
        .service("api::usercard.usercard")
        .achievementTrigger(user, TYPES.STATS_OPTIONS.card_unlock);

      return {
        usercard,
        ...(artifact && { rewards: { ...artifact } }),
      };
    }

    const userCardRelation = await STRAPI.getOrCreateUserCard(ctx, card);

    // 2. ========== COMPLETE A CARD: PROGRAM
    if (action === API_ACTIONS.updateCard.complete) {
      const isProgramMastered =
        userCardRelation.completed >= CONFIG.PROGRAM_COMPLETED_MAX;
      if (
        FUNCTIONS.lessThan24HoursAgo(userCardRelation.completed_at) ||
        isProgramMastered
      ) {
        // add to last completed - maybe as a servrice reusable?
        let new_last_completed = user.last_completed_cards;
        new_last_completed.push(card_id);
        if (new_last_completed.length > CONFIG.MAX_COMPLETED_CARDS) {
          new_last_completed.shift();
        }

        const payload = {
          last_completed_cards: new_last_completed,
          stats: { ...user.stats, mastery: user.stats["mastery"] + 10 },
        };

        const updatedUser = await STRAPI.updateUser(user.id, payload, {
          artifacts: true,
        });

        const update = {
          completed_at: Date.now(),
          ...(!isProgramMastered
            ? {
                completed: userCardRelation.completed + 1,
              }
            : { glory_points: userCardRelation.glory_points + 1 }),
        };

        const usercardUpdated = await strapi.db
          .query("api::usercard.usercard")
          .update({
            where: { user: user.id, card: card_id },
            data: update,
          });

        //update objectives
        const objectivesForNotification = await strapi
          .service("api::usercard.usercard")
          .objectivesTrigger(updatedUser, TYPES.OBJECTIVE_TRIGGERS.complete);

        //update artifacts
        // TODO: ADD MULTIDIMENSIONAL ACHIVEMENT TRIGGER (mastery + cards_complete -> complete_program/card)
        const artifact1 = await strapi
          .service("api::usercard.usercard")
          .achievementTrigger(updatedUser, TYPES.STATS_OPTIONS.cards_complete);

        const artifact2 = await strapi
          .service("api::usercard.usercard")
          .achievementTrigger(updatedUser, TYPES.STATS_OPTIONS.cards_complete);

        return {
          usercard: usercardUpdated,
          objectivesForNotification,
          ...((artifact1 || artifact2) && {
            rewards: { artifact: artifact1, artifact: artifact2 },
          }),
        };
      } else {
        ctx.throw(400, "you need to wait xx before you can complete it again");
      }
    }

    // 3. ========== Trigger Favorite ON/OFF .
    if (action === API_ACTIONS.updateCard.favorite) {
      const update = {
        is_favorite: !userCardRelation.is_favorite,
      };
      const data = await strapi.db.query("api::usercard.usercard").update({
        where: { user: user.id, card: card_id },
        data: update,
      });

      let newFavoriteCards = user.favorite_cards || [];

      const alreadyFavorite =
        newFavoriteCards.length > 0 &&
        newFavoriteCards.filter((a) => a.id == card_id).length > 0;

      if (alreadyFavorite) {
        newFavoriteCards = newFavoriteCards.filter((a) => a.id != card_id);
      } else {
        newFavoriteCards.push(card_id);
      }

      const userUpdate = {
        favorite_cards: newFavoriteCards,
      };
      await STRAPI.updateUser(user.id, userUpdate);

      return { usercard: data };
    }
  },

  achievementTrigger: async (user, requirement) => {
    let user_stats = user.stats || USER.DEFAULT_USER_STATS;

    if (!CONFIG.ARTIFACTS_TABLE[requirement]) {
      console.log("wrong type name??", requirement);
      return false;
    }

    const statUpdated = user_stats[requirement] + 1;

    const shouldGainArtifact =
      CONFIG.ARTIFACTS_TABLE[requirement].filter((req) => req === statUpdated)
        .length > 0;

    let artifact = false;

    if (shouldGainArtifact) {
      artifact = await strapi.db.query("api::artifact.artifact").findOne({
        where: { type: requirement, require: statUpdated },
      });

      await strapi
        .service("api::usercard.usercard")
        .gainArtifact(user, artifact.id);
    }

    await STRAPI.updateStats(user, requirement);

    return shouldGainArtifact && artifact;

    // return {
    //   rewards: shouldGainArtifact && { artifact: artifact },
    // };
  },

  objectivesTrigger: async (user, requirement) => {
    const objectives = await strapi.db
      .query("api::objective.objective")
      .findMany();

    let user_objectives = user.objectives_json || {};

    // objectives for notification
    let objectivesForNotification = [];

    objectives.forEach((obj) => {
      if (obj.requirement === requirement) {
        if (user_objectives[obj.id]) {
          user_objectives[obj.id].progress =
            user_objectives[obj.id].progress + 1;
        } else {
          user_objectives[obj.id] = {
            progress: 1,
            isCollected: false,
          };
        }
        // notification prepare (if 1. obj is pro but user is not, 2. obj is not collected and 3. obj is not daily/weekly)
        if (
          !(obj.is_premium && !user.pro) &&
          !user_objectives[obj.id].isCollected &&
          !(
            obj.requirement == TYPES.OBJECTIVE_TRIGGERS.daily ||
            obj.requirement == TYPES.OBJECTIVE_TRIGGERS.weekly
          )
        ) {
          objectivesForNotification.push({
            ...obj,
            progress: user_objectives[obj.id]
              ? user_objectives[obj.id].progress
              : 1,
            isCollected: false,
          });
        }
      }
    });

    const upload = {
      objectives_json: user_objectives,
    };

    await STRAPI.updateUser(user.id, upload);
    return objectivesForNotification;
    // {
    //   objectives_json: data.objectives_json,
    //   objectivesForNotification,
    // };
  },

  gainCard: async (ctx, card) => {
    const usercard = await STRAPI.getOrCreateUserCard(ctx, card, true);
    return { card, usercard };
  },

  getRandomUndroppedContent: async (ctx, user) => {
    const cardIds = user.unlocked_cards || [];
    const contentTypes = Object.keys(C_TYPES.CONTENT_MAP).filter(
      (ct) => ct != "stories" && ct != "casestudies" // they have 1 content type - ITS ALWAYS OPEN
    );
    console.log({ contentTypes });
    while (contentTypes.length > 0) {
      const randomIndex = Math.floor(Math.random() * contentTypes.length);
      const randomContentType = contentTypes[randomIndex];
      contentTypes.splice(randomIndex, 1);
      const formattedContentType =
        C_TYPES.CONTENT_MAP[randomContentType].single;

      if (!formattedContentType) {
        ctx.throw(400, "You've unlocked all content types");
      }

      const undroppedContent = await strapi.db
        .query(`api::${formattedContentType}.${formattedContentType}`)
        .findMany({
          where: {
            $and: [
              {
                isOpen: false,
              },
              {
                $or: [
                  {
                    card: {
                      id: { $in: cardIds },
                    },
                  },
                  {
                    card: {
                      is_open: true,
                    },
                  },
                  ...(user.pro
                    ? [
                        {
                          card: {
                            type: "premium",
                          },
                        },
                      ]
                    : []),
                ],
              },
            ],
          },
          // populate: { card: true },
        });

      console.log({ lootbox: undroppedContent.length });

      if (undroppedContent.length > 0) {
        const undroppedContentIds = undroppedContent.map(
          (content) => content.id
        );

        const userDroppedContent =
          user.droppedContent?.[randomContentType] || [];
        const undroppedContentIdsFiltered = undroppedContentIds.filter(
          (id) => !userDroppedContent.includes(parseInt(id))
        );

        console.log("undropped =>", undroppedContentIdsFiltered.length);

        if (undroppedContentIdsFiltered.length > 0) {
          const randomUndroppedContentIndex = Math.floor(
            Math.random() * undroppedContentIdsFiltered.length
          );
          const randomUndroppedContentId =
            undroppedContentIdsFiltered[randomUndroppedContentIndex];

          const randomUndroppedContent = undroppedContent.find(
            (content) => content.id === randomUndroppedContentId
          );

          return {
            reward: randomUndroppedContent,
            rewardType: randomContentType,
          };
        }
      }
    }

    return { error: true };
  },
}));
