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

  sendEmailTemplate: async (template) => {
    const defaultTemplate = "welcome-email";

    const emailTemplate = {
      subject: "Welcome <%= user.username %>",
      text: `Welcome to mywebsite.fr!
        Your account is now linked with: <%= user.email %>.`,
      html: fs.readFileSync(
        path.join(
          __dirname,
          `../../../extensions/email/templates/${
            template || defaultTemplate
          }.html`
        ),
        "utf8"
      ),
    };

    await strapi.plugins["email"].services.email.sendTemplatedEmail(
      {
        // to: user.email, TODO:
        to: "dejan.gavrilovikk@gmail.com",
      },
      emailTemplate,
      {
        user: { username: "deno", email: "dejan.gavrilovikk@gmail.com" },
      }
    );

    return { success: true };
  },

  // reset-user on daily/weekly basis
  resetUser: async (user, today) => {
    const { resetWeekDate, isWeekRestarted } = FUNCTIONS.calculateWeekReset(
      user,
      today
    );

    await STRAPI.updateUser(user.id, {
      energy:
        user.energy <= CONFIG.DEFAULT_ENERGY
          ? CONFIG.DEFAULT_ENERGY
          : user.energy,
      reset_date: FUNCTIONS.formatDate(today),

      reset_week_date: resetWeekDate,
      objectives_json: await FUNCTIONS.resetUserObjectives(
        user.objectives_json,
        isWeekRestarted
      ),
    });
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
      populate: {
        user: true,
        product: true,
      },
    });
    newOrder.user = newOrder.user.id;
    newOrder.product = newOrder.product.id;
    return newOrder;
  },

  updateCard: async (user, card_id, action, ctx, contentIndex) => {
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

      const artifactData = await strapi
        .service("api::usercard.usercard")
        .achievementTrigger(user, TYPES.ARTIFACT_TRIGGERS.cardsUnlock);


      console.log("artifactData", artifactData);

      return {
        usercard: usercard,

        rewards: artifactData.artifactData && {
          artifact: artifactData.artifactData,
        },
      };
    }

    const userCardRelation = await STRAPI.getOrCreateUserCard(ctx, card);


    // 2. ========== COMPLETE A CARD:
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
        const payload = { last_completed_cards: new_last_completed };

        await STRAPI.updateUser(user.id, payload);

        const update = {

          completed_at: Date.now(),
          ...(!isProgramMastered
            ? {
                completed: userCardRelation.completed + 1,
                mastery: userCardRelation.mastery + 1,
              }
            : { glory_points: userCardRelation.glory_points + 1 }),
        };

        const usercardUpdated = await strapi.db
          .query("api::usercard.usercard")
          .update({
            where: { user: user.id, card: card_id },
            data: update,
          });

        // update mastery
        await STRAPI.updateUser(user.id, {
          stats: { ...user.stats, mastery: user.stats.mastery + 1 },
        });

        //update objectives
        await strapi
          .service("api::usercard.usercard")
          .objectivesTrigger(user, TYPES.OBJECTIVE_TRIGGERS.complete);

        //update artifacts
        const artifactData = await strapi
          .service("api::usercard.usercard")
          .achievementTrigger(user, TYPES.ARTIFACT_TRIGGERS.cardsComplete);

        return {
          usercard: usercardUpdated,
          modal: artifactData && {
            artifactData: artifactData.artifactData,
            stats: artifactData.data,
          },
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
      console.log("wrong type name??");
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

    const updated_user_stats = {
      ...user_stats,
      [requirement]: statUpdated,
    };

    const upload = {
      stats: updated_user_stats,
    };

    const data = await STRAPI.updateUser(user.id, upload);
    return {
      data: data.stats,
      rewards: shouldGainArtifact && { artifact: artifact },
    };
  },

  objectivesTrigger: async (user, requirement) => {
    const objectives = await strapi.db
      .query("api::objective.objective")
      .findMany();

    let user_objectives = user.objectives_json || {};

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
      }
    });

    const upload = {
      objectives_json: user_objectives,
    };

    const data = await STRAPI.updateUser(user.id, upload);
    return {
      objectives_json: data.objectives_json,
    };
  },

  gainCard: async (ctx, card) => {

    const usercard = await STRAPI.getOrCreateUserCard(ctx, card, true);
    return { card, usercard };
  },


  getRandomUndroppedContent: async (ctx, user) => {
    const cardIds = user.unlocked_cards?.ids || [];
    const contentTypes = C_TYPES.CONTENT_TYPES;
    while (contentTypes.length > 0) {
      const randomIndex = Math.floor(Math.random() * contentTypes.length);
      const randomContentType = contentTypes[randomIndex];
      contentTypes.splice(randomIndex, 1);
      const formattedContentType = C_TYPES.singularize(randomContentType);

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
                ],
              },
            ],
          },
          // populate: { card: true },
        });

      if (undroppedContent.length > 0) {
        const undroppedContentIds = undroppedContent.map(
          (content) => content.id
        );

        const userDroppedContent =
          user.droppedContent?.[randomContentType] || [];
        const undroppedContentIdsFiltered = undroppedContentIds.filter(
          (id) => !userDroppedContent.includes(parseInt(id))
        );

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
