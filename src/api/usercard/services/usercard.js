"use strict";

/**
 * usercard service.
 */

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
  console.log(userCardRelation);
  return userCardRelation;
};

module.exports = createCoreService("api::usercard.usercard", ({ strapi }) => ({
  //DONE
  gainReward: async (user, rewardType = "box_1", quantity = 1) => {
    // rewardType =
    //  "card-${rarity}"
    //  "box-${boxId}"
    //  "xp", "stars", "gems"

    // 1. RANDOM CARD GENERATOR
    if (rewardType.includes("card")) {
      const rarity = rewardType.split("_")[1];
      if (rarity === "any") {
        //DUPLICATE FUNCTION - fix if ANY CARD (WILD)
        const determineRarity = () => {
          const drop_table = {
            common: 69,
            rare: 89,
            epic: 99,
            legendary: 100,
          };
          const randomNumber = Math.floor(Math.random() * 101);
          for (const rarity in drop_table) {
            if (randomNumber <= drop_table[rarity]) {
              return rarity;
            }
          }
        };

        await strapi
          .service("api::usercard.usercard")
          .gainCard(user, determineRarity());
      } else {
        await strapi.service("api::usercard.usercard").gainCard(user, rarity);
      }
    }
    // 2. LOOT BOX GENERATOR
    if (rewardType.includes("box")) {
      const boxId = parseInt(rewardType.split("_")[1]);
      const boxes = user.boxes || {};
      const hasBox = boxes[boxId];

      if (!hasBox) {
        const payload = { boxes: { ...user.boxes, [boxId]: quantity } };
        const data = await updateUser(user.id, payload);
        // POPULATE LESS FIELD SANITIZE!!!
        return data;
      } else {
        const payload = {
          boxes: { ...user.boxes, [boxId]: user.boxes[boxId] + quantity },
        };
        const data = await updateUser(user.id, payload);
        // POPULATE LESS FIELD SANITIZE!!!
        return data;
      }
    }
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
  //DONE
  gainCard: async (user, payload, fromBox = false) => {
    // payload = {
    //   rarity: "common",  => if fromBox is true: return specific card by id, if false: generate random card by rarity
    //   card: 2,  => if fromBox = true // from PACKS
    //   quantity: 5
    // };
    let rewardCard;
    let rewardQuantity;
    if (!fromBox) {
      //1. api get all cards ( filter only by expansion set from user relationship, filter by rarity)
      const openExpansions = user.expansions.map((ex) => ex.id);

      openExpansions.push(1); // add base set if not added

      const cards = await strapi.db.query("api::card.card").find({
        where: {
          rarity: payload.rarity,
          expansion: openExpansions,
        },
      });

      //2. generate random number between 0 and cards.length
      const randomId = Math.floor(Math.random() * cards.length);

      //3. get that card -> add to usercards collection
      rewardCard = cards[randomId];

      //4. get random quantity -> drops
      const getRandomQuantity = (min, max) => {
        return Math.floor(Math.random() * (max - min + 1) + min);
      };
      rewardQuantity = getRandomQuantity(3, 6);
    }

    if (fromBox) {
      rewardCard = payload.card;
      rewardQuantity = payload.quantity;
    }

    // logic ->
    const userCardRelation = await getUserCard(user.id, rewardCard.id);
    console.log("user card relation", userCardRelation);

    if (userCardRelation) {
      //update
      await strapi.db.query("api::usercard.usercard").update({
        where: { user: user.id, card: rewardCard.id },
        data: {
          quantity: userCardRelation.quantity + rewardQuantity,
        },
      });
    } else {
      //create new
      await strapi.db.query("api::usercard.usercard").create({
        data: {
          user: user.id,
          card: rewardCard.id,
          quantity: rewardCard.isOpen ? rewardQuantity + 1 : rewardQuantity,
          isNew: true,
          user_name: user.username,
          completed: 0,
          isUnlocked: rewardCard.isOpen ? true : false,
        },
      });
    }
    return {
      card: rewardCard.id,
      quantity: rewardQuantity,
      isNew: !userCardRelation,
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
      populate: {
        expansion: true,
      },
    });

    // FORCED - CHANGE IT - premium id: 2
    const expansionId = card.expansion.id;

    if (
      expansionId === 2 &&
      user.expansions.filter((e) => e.id === expansionId).length === 0
    ) {
      ctx.throw(400, `You need to purchase Pro expansion to access this card.`);
    }
    console.log(user.expansions.filter((e) => e.id === card.expansion.id));

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

    const userCardRelation = await generateUserCardRelation();
    if (!userCardRelation) {
      ctx.throw(400, `You do not have this card yet.`);
      return;
    }

    let update;

    // 2. ========== COMPLETE A CARD:
    if (action === "complete") {
      const isUnlocked = userCardRelation.is_unlocked;
      if (!isUnlocked) {
        ctx.throw(400, `This card is not unlocked yet.`);
      }

      const allowedLevels = {
        1: [1],
        2: [1, 2],
        3: [1, 2, 3],
        4: [1, 2, 3, 4],
        5: [1, 2, 3, 4, 5],
      };

      const isCardLevelAllowed = allowedLevels[userCardRelation.level].includes(
        userCardRelation.completed + 1
      );

      if (!isCardLevelAllowed) {
        ctx.throw(400, "YOU NEED TO UPGRADE THE CARD TO UNLOCK THIS LEVEL!");
      }

      if (userCardRelation.completed <= 4) {
        if (user.energy > 0) {
          let new_last_completed = user.last_completed_cards;

          new_last_completed.push(card_id);

          const payload = { last_completed_cards: new_last_completed };

          await updateUser(user.id, payload);

          update = {
            completed: userCardRelation.completed + 1,
            completed_at: Date.now(),
          };
        } else {
          ctx.throw(400, `You don't have enough energy! Come back tomorrow :)`);
        }
      }

      if (userCardRelation.completed >= 5) {
        update = {
          completed_at: Date.now(),
          glory_points: userCardRelation.glory_points + 1,
        };
        // update["user"] = user.id;
        // update["card"] = card_id;

        const data = await strapi.db.query("api::usercard.usercard").update({
          where: { user: user.id, card: card_id },
          data: update,
        });
        return data;
        // think of structured way to ping back notifications/toasters/modals
      }
      // DO REAL CHANGES...
      function getCardCompleteReward(cardLevel) {
        // @calc
        return {
          xp: 50 + cardLevel * 10,
          stars: 20 + cardLevel * 3,
        };
      }
      const cardRewards = getCardCompleteReward(userCardRelation.completed);
      console.log(cardRewards);

      const xp = await strapi
        .service("api::usercard.usercard")
        .gainReward(user, "xp", cardRewards.xp);
      const stars = await strapi
        .service("api::usercard.usercard")
        .gainReward(user, "stars", cardRewards.stars);
      const energy = await strapi
        .service("api::usercard.usercard")
        .gainReward(user, "energy", -1);

      console.log(xp, stars, energy);

      // update["users_permissions_user"] = user.id;
      // update["card"] = card_id;

      // UPDATE OBJECTIVES TRIGGER
      await strapi
        .service("api::usercard.usercard")
        .achievementTrigger(user, "complete");

      const data = await strapi.db.query("api::usercard.usercard").update({
        where: { user: user.id, card: card_id },
        data: update,
      });

      return {
        data,
        // think of structured way to ping back notifications/toasters/modals
        notification: {
          trigger: "level-modal",
          rewards: { xp, stars, energy },
        },
      };
    }

    // 3. ========== UPGRADE A CARD:
    if (action === "upgrade") {
      const upgrades_table = {
        // @calc
        1: 2,
        2: 4,
        3: 6,
        4: 8,
      };
      const isUnlocked = userCardRelation.is_unlocked;
      const current_card_level = userCardRelation.level;
      const collected_copies = userCardRelation.quantity;
      const required_copies = upgrades_table[current_card_level];
      if (!isUnlocked && !card.is_open) {
        ctx.throw(400, `This card is not unlocked yet.`);
      }
      if (!required_copies) {
        ctx.throw(400, `This card is maximum level.`);
      }
      if (collected_copies < required_copies) {
        ctx.throw(
          400,
          `You need ${
            required_copies - collected_copies
          } more copies to upgrade this card.`
        );
      }
      //logic here...
      update = {
        quantity: userCardRelation.quantity - required_copies,
        level: userCardRelation.level + 1,
      };
    }

    // 3.5 ======= UNLOCK A CARD
    if (action === "unlock") {
      const isUnlocked = userCardRelation.is_unlocked;
      const collected_copies = userCardRelation.quantity;

      if (isUnlocked) {
        ctx.throw(400, `This card is already unlocked.`);
      }
      if (collected_copies < 10) {
        ctx.throw(
          400,
          `You need ${10 - collected_copies} more copies to unlock this card.`
        );
      }
      //logic here...
      update = {
        quantity: userCardRelation.quantity - 10,
        is_unlocked: true,
      };
      let new_last_unlocked = user.last_unlocked_cards;

      if (new_last_unlocked.length > 4) {
        new_last_unlocked[0] = card_id;
      } else {
        new_last_unlocked.push(card_id);
      }

      const payload = { last_unlocked_cards: new_last_unlocked };

      await updateUser(user.id, payload);
    }

    // 4. ========== NEW A CARD:
    if (action === "new_activate") {
      update = {
        is_new: true,
      };
    }
    if (action === "new_disable") {
      update = {
        is_new: false,
      };
    }
    // 5. ========== Trigger Favorite ON/OFF
    if (action === "favorite") {
      update = {
        is_favorite: !userCardRelation.is_favorite,
      };
    }

    // update["user"] = user.id;
    // update["card"] = card_id;

    const data = await strapi.db.query("api::usercard.usercard").update({
      where: { user: user.id, card: card_id },
      data: update,
    });

    return data;
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
