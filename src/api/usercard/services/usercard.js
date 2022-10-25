"use strict";

const { createCoreService } = require("@strapi/strapi").factories;

const sanitizeUser = (user) => {
  delete user["provider"];
  delete user["password"];
  delete user["resetPasswordToken"];
  delete user["confirmationToken"];
  delete user["confirmed"];
  delete user["blocked"];
  delete user["updatedAt"];
  delete user["createdAt"];
  return user;
};

const updateUser = async (
  id,
  payload,
  populate = { usercards: true, expansions: true, orders: true }
) => {
  const user = await strapi.db.query("plugin::users-permissions.user").update({
    where: { id: id },
    data: payload,
    populate: populate,
  });

  return sanitizeUser(user);
};

const getUserCard = async (userId, cardId) => {
  const userCardRelation = await strapi.db
    .query("api::usercard.usercard")
    .findOne({ where: { user: userId, card: cardId } });
  return userCardRelation;
};

module.exports = createCoreService("api::usercard.usercard", ({ strapi }) => ({
  //DONE
  gainReward: async (user, rewardType, quantity) => {
    // 3. XP UPDATE
    if (rewardType === "xp") {
      // @calc
      function getXpLimit(level) {
        return 100 + level * 10 * 1.6;
      }
      const xpLimit = getXpLimit(user.level);
      if (user.xp + quantity > xpLimit) {
        const payload = {
          xp: user.xp + quantity - xpLimit,
          level: user.level + 1,
        };
        const data = await updateUser(user.id, payload);

        return {
          rewardType: rewardType,
          quantity: data[rewardType],
        };
      }
    }
    // 4. GENERIC STARS/GEMS...
    const payload = {
      [rewardType]: user[rewardType] + quantity,
    };
    const data = await updateUser(user.id, payload);
    return {
      rewardType: rewardType,
      quantity: data[rewardType],
    };
  },

  createOrder: async (user, product, API) => {
    const newOrder = await strapi.db.query("api::order.order").create({
      data: {
        user: user.id,
        product: product.id,
        user_name: user.username,
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

  updateCard: async (user, card_id, action, ctx) => {
    const card = await strapi.db.query("api::card.card").findOne({
      where: {
        id: card_id,
      },
    });

    async function generateUserCardRelation() {
      const checkUserCardRelation = await strapi.db
        .query("api::usercard.usercard")
        .findOne({ where: { user: user.id, card: card_id } });
      //populate

      if (!checkUserCardRelation && card.is_open) {
        const newUserCardRelation = await strapi.db
          .query("api::usercard.usercard")
          .create({
            data: {
              user: user.id,
              card: card.id,
              quantity: 1,
              completed: 0,
              glory_points: 0,
              is_unlocked: true,
              is_new: true,
              user_name: user.username,
            },
          });
        return newUserCardRelation;
      }
      return checkUserCardRelation;
    }
    // 0. COMPLETE ACTION
    if (action === "complete_action") {
      if (user.energy > 0 || user.is_subscribed) {
        await strapi
          .service("api::usercard.usercard")
          .gainReward(user, "energy", -1);

        await strapi
          .service("api::usercard.usercard")
          .achievementTrigger(user, "action");

        return {
          achievement: "Action completed... ",
        };
      }
    }

    // 0.5. ========== Action Trigger Favorite ON/OFF
    if (action === "favorite_action") {
      // card_id = action id actually
      let newFavoriteActions = user.favorite_actions || [];

      const alreadyFavorite =
        newFavoriteActions.length > 0 &&
        newFavoriteActions.filter((a) => parseInt(a.id) == parseInt(card_id))
          .length > 0;

      if (alreadyFavorite) {
        newFavoriteActions = newFavoriteActions.filter((a) => a.id != card_id);
      } else {
        newFavoriteActions.push(card_id);
      }

      const update = {
        favorite_actions: newFavoriteActions,
      };
      const data = updateUser(user.id, update);

      return data;
    }

    // 1 ======= UNLOCK A CARD
    if (action === "unlock") {
      // check if have enough stars
      const canUnlock = user.stars >= card.cost;
      if (!canUnlock) {
        return ctx.throw(
          400,
          `You do not have enough stars to unlock this card.`
        );
      }
      //if can -> create usercard relation first
      const newUserCardRelation = await strapi.db
        .query("api::usercard.usercard")
        .create({
          data: {
            user: user.id,
            card: card.id,
            completed: 0,
            glory_points: 0,
            is_unlocked: true,
            user_name: user.username,
          },
        });

      const payload = {
        stars: user.stars - card.cost,
      };

      await updateUser(user.id, payload);
      return newUserCardRelation;
    }
    // check user relation for other actions...
    const userCardRelation = await generateUserCardRelation();
    if (!userCardRelation) {
      ctx.throw(400, `You do not have this card yet.`);
      return;
    }

    // 2. ========== COMPLETE A CARD:
    if (action === "complete") {
      if (user.energy > 0 || user.is_subscribed) {
        // add to last completed - maybe as a servrice reusable?
        let new_last_completed = user.last_completed_cards;
        new_last_completed.push(card_id);
        const payload = { last_completed_cards: new_last_completed };
        await updateUser(user.id, payload);
        //---

        await strapi
          .service("api::usercard.usercard")
          .gainReward(user, "energy", -1);

        // UPDATE OBJECTIVES TRIGGER
        await strapi
          .service("api::usercard.usercard")
          .achievementTrigger(user, "action");

        const update = {
          completed: userCardRelation.completed + 1,
          completed_at: Date.now(),
        };

        const data = await strapi.db.query("api::usercard.usercard").update({
          where: { user: user.id, card: card_id },
          data: update,
        });

        return {
          data,
          // think of structured way to ping back notifications/toasters/modals
          notification: {
            trigger: "achiuevmeent?",
          },
        };

        // think of structured way to ping back notifications/toasters/modals
      } else {
        ctx.throw(400, `You don't have enough energy to perform this action.`);
      }
    }

    // 3. ========== Trigger Favorite ON/OFF
    if (action === "favorite_card") {
      const update = {
        is_favorite: !userCardRelation.is_favorite,
      };
      const data = await strapi.db.query("api::usercard.usercard").update({
        where: { user: user.id, card: card_id },
        data: update,
      });
      return data;
    }
  },
  achievementTrigger: async (user, requirement) => {
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

    const data = await updateUser(user.id, upload);
    return {
      objectives_json: data.objectives_json,
    };
  },
}));
