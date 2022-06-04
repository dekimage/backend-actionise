"use strict";
const { createCoreController } = require("@strapi/strapi").factories;

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
const formatDate = (date) => {
  const padTo2Digits = (num) => {
    return num.toString().padStart(2, "0");
  };
  return [
    date.getFullYear(),
    padTo2Digits(date.getMonth() + 1),
    padTo2Digits(date.getDate()),
  ].join("-");
};
const getUserCard = async (userId, cardId) => {
  const userCardRelation = await strapi
    .query("usercard")
    .findOne({ users_permissions_user: userId, card: cardId }, ["quantity"]);
  return userCardRelation;
};
const getUser = async (id, populate = {}) => {
  const defaultPopulate = {
    usercards: true,
    expansions: true,
    orders: true,
  };
  const entry = await strapi.db
    .query("plugin::users-permissions.user")
    .findOne({
      // select: ['title', 'description'],
      where: { id: id },
      populate: { ...defaultPopulate, ...populate },
    });
  return sanitizeUser(entry);
};

const updateUser = async (id, payload, populate = {}) => {
  const defaultPopulate = { usercards: true, expansions: true, orders: true };
  const user = await strapi.db.query("plugin::users-permissions.user").update({
    where: { id: id },
    data: payload,
    populate: { ...defaultPopulate, ...populate },
  });

  return sanitizeUser(user);
};
module.exports = createCoreController(
  "api::usercard.usercard",
  ({ strapi }) => ({
    //DONE
    async me(ctx) {
      const user = ctx.state.user;

      if (!user) {
        return ctx.badRequest(null, [
          { messages: [{ id: "No authorization header was found" }] },
        ]);
      }

      const today = new Date();
      const isRestarted = formatDate(today) === user.reset_date;

      if (!isRestarted) {
        const resetUser = await updateUser(user.id, {
          energy: 3,
          reset_date: formatDate(today),
          objectives_counter: {
            daily: {
              1: false,
              2: false,
              3: false,
              4: false,
            },
            weekly: {
              1: false,
              2: false,
              3: false,
              4: false,
            },
          },
          objectives_json: {
            ...user.objectives_json,
            1: { progress: 0, isCollected: false },
            3: { progress: 1, isCollected: false },
            4: { progress: 0, isCollected: false },
            5: { progress: 0, isCollected: false },
          },
        });
      }
      const data = await getUser(user.id, {
        usercards: true,
        expansions: true,
        orders: true,
        communityactions: true,
        shared_by: true,
        shared_buddies: true,
        last_unlocked_cards: true,
        last_completed_cards: true,
        followers: true,
        followedBy: true,
      });
      // const userWithMedia = await userQuery.findOne({ id: ctx.state.user.id }, [
      //   "usercards",
      //   "community_actions",
      //   "community_actions.steps",
      //   "community_actions.card",
      //   "shared_buddies",
      //   "shared_buddies.image",
      //   "expansions",
      //   "followers ",
      //   "today_completed",
      //   "followers ",
      //   "last_collected_cards",
      //   "level_rewards",
      //   "followers",
      //   "followers.image",
      //   "image",
      //   // "usercards.card", -> if I want to query deeper
      // ]);

      return data;
    },
    // DONE
    async updateCard(ctx) {
      const user = await getUser(ctx.state.user.id, {
        last_completed_cards: true,
        last_unlocked_cards: true,
      });

      const card_id = ctx.params.id;
      const action = ctx.request.body.action;
      if (
        action !== "new_disable" &&
        action !== "new_activate" &&
        action !== "complete" &&
        action !== "upgrade" &&
        action !== "unlock" &&
        action !== "favorite"
      ) {
        ctx.throw(400, "You can't update the card with unknown intent.");
      }

      let updatedUserCardRelation = await strapi
        .service("api::usercard.usercard")
        .updateCard(user, card_id, action, ctx);

      // OMITTING SENSITIVE DATA TODO: REFETCH QUERY -> NO NEED FOR ANY DATA
      // updatedUserCardRelation["users_permissions_user"] = user.id;
      // updatedUserCardRelation["updated_by"] = user.id;
      // updatedUserCardRelation.users_permissions_user.id;
      return updatedUserCardRelation;
    },
    // DONE
    async collectStreakReward(ctx) {
      const user = await getUser(ctx.state.user.id, { shared_buddies: true });

      const streakCount = ctx.params.id;

      const streakReward = await strapi.db
        .query("api::streakreward.streakreward")
        .findOne({
          where: { streak_count: streakCount },
          populate: { reward_card: true, reward_box: true },
        });

      let userRewards = user.streak_rewards || {};

      if (!streakReward) {
        return ctx.badRequest("This streak reward does not exist.");
      }

      if (user.highest_streak_count < streakReward.streak_count) {
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

      const data = await updateUser(user.id, upload);

      // GAIN REWARDS SERVICE TRIGGER
      if (streakReward.reward_card) {
        const payload = {
          card: streakReward.reward_card,
          quantity: streakReward.reward_amount,
        };

        const updatedRewards = await strapi
          .service("api::usercard.usercard")
          .gainCard(user, payload, true);

        return {
          streak_count: data.streak_count,
          updatedRewards,
        };
      }

      if (streakReward.reward_box) {
        const rewardType = `box_${streakReward.reward_box.id}`;
        const quantity = streakReward.reward_amount;

        const updatedRewards = await strapi
          .service("api::usercard.usercard")
          .gainReward(user, rewardType, quantity);

        return {
          streak_count: data.streak_count,
          updatedRewards,
        };
      }
    },
    // DONE
    async collectFriendsReward(ctx) {
      // static data
      const user = await getUser(ctx.state.user.id);

      const friendsCount = ctx.params.id;

      const friendsReward = await strapi.db
        .query("api::friendreward.friendreward")
        .findOne({
          where: { friends_count: friendsCount },
          populate: { reward_card: true },
        });

      let userRewards = user.friends_rewards || {};

      if (!friendsReward) {
        return ctx.badRequest("This friend reward does not exist.");
      }

      if (user.shared_buddies.length < friendsReward.friends_count) {
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
      };

      const data = await updateUser(user.id, upload);

      // GAIN REWARDS SERVICE TRIGGER
      const payload = {
        card: friendsReward.reward_card,
        quantity: friendsReward.reward_amount,
      };

      const updatedRewards = await strapi
        .service("api::usercard.usercard")
        .gainCard(user, payload, true);

      return {
        friends_count: data.friends_count,
        updatedRewards,
      };
    },
    // DONE
    async collectLevelReward(ctx) {
      // static data
      const user = await getUser(ctx.state.user.id);

      const levelId = ctx.params.id;

      const levelReward = await strapi.db
        .query("api::levelreward.levelreward")
        .findOne({
          where: { id: levelId },
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

      if (!user.is_subscribed && levelReward.is_premium) {
        return ctx.badRequest(
          "You need premium subscription to unlock this reward."
        );
      }

      if (userRewards[levelReward.id]) {
        ctx.throw(400, `You have already claimed this reward.`);
      }

      // SAVE PROGRESS
      userRewards = { ...userRewards, [levelReward.id]: true };

      const upload = {
        rewards_tower: userRewards,
      };

      const data = await updateUser(user.id, upload);

      // GAIN REWARDS SERVICE TRIGGER
      const rewardType = levelReward.reward_type;
      const quantity = levelReward.reward_amount;

      const updatedRewards = await strapi
        .service("api::usercard.usercard")
        .gainReward(user, rewardType, quantity);

      return {
        rewards_tower: data.rewards_tower,
        updatedRewards,
      };
    },
    // DONE
    async claimObjectiveCounter(ctx) {
      const objectiveCounterId = ctx.params.id;
      const temporal_type = ctx.request.body.temporal_type; // PASS AS DATA??

      console.log(temporal_type);

      const user = await getUser(ctx.state.user.id);

      const user_objectives = user.objectives_json;
      let user_objectives_counter = user.objectives_counter || {};

      if (!objectiveCounterId || !temporal_type) {
        ctx.throw(400, `Please provide objective id and type`);
      }
      if (objectiveCounterId < 1 || objectiveCounterId > 4) {
        ctx.throw(400, `This objective reward does not exist.`);
      }
      if (temporal_type !== "daily" && temporal_type !== "weekly") {
        ctx.throw(400, `This objective temporal_type does not exist.`);
      }

      const userCounter =
        user_objectives_counter[temporal_type] &&
        user_objectives_counter[temporal_type][objectiveCounterId];

      let completedObjectivesCount = 0;

      const objectives = await strapi.db
        .query("api::objective.objective")
        .findMany({
          where: {
            time_type: temporal_type,
          },
        });

      const objectivesIds = objectives.map((obj) => obj.id);
      //user_objectives nema ids, treba da vlezam vo temporal type za da gi najdam
      // check progress by the other objective json...

      for (const id in user_objectives) {
        if (objectivesIds.includes(parseInt(id))) {
          completedObjectivesCount++;
        }
      }

      if (completedObjectivesCount < objectiveCounterId) {
        ctx.throw(
          400,
          `You need to complete ${
            objectiveCounterId - completedObjectivesCount
          } more ${temporal_type} objectives to unlock this reward tier.`
        );
      }
      // LOGIC
      if (user_objectives_counter[temporal_type]) {
        user_objectives_counter[temporal_type][objectiveCounterId] = true;
      } else {
        user_objectives_counter[temporal_type] = {
          [objectiveCounterId]: true,
        };
      }

      const payload = { objectives_counter: user_objectives_counter };
      const data = await updateUser(user.id, payload);

      // GAIN REWARDS SERVICE TRIGGER
      //@calc
      const objectiveCounterRewardsTable = {
        daily: {
          1: {
            reward_type: "stars",
            reward_quantity: 10,
          },
          2: {
            reward_type: "stars",
            reward_quantity: 15,
          },
          3: {
            reward_type: "card_random",
            reward_quantity: 5,
          },
          4: {
            reward_type: "box_1",
            reward_quantity: 1,
          },
        },
        weekly: {
          1: {
            reward_type: "stars",
            reward_quantity: 50,
          },
          2: {
            reward_type: "stars",
            reward_quantity: 75,
          },
          3: {
            reward_type: "card_legendary",
            reward_quantity: 5,
          },
          4: {
            reward_type: "box_2",
            reward_quantity: 1,
          },
        },
      };

      const rewardType =
        objectiveCounterRewardsTable[temporal_type][objectiveCounterId]
          .reward_type;
      const quantity =
        objectiveCounterRewardsTable[temporal_type][objectiveCounterId]
          .reward_quantity;

      const updatedRewards = await strapi
        .service("api::usercard.usercard")
        .gainReward(user, rewardType, quantity);

      return {
        objectives_counter: data.objectives_counter,
        updatedRewards,
      };
    },
    // DONE
    async claimObjective(ctx) {
      const objectiveId = ctx.params.id;
      const user = await getUser(ctx.state.user.id);
      const user_objectives = user.objectives_json || {};

      const objective = await strapi.db
        .query("api::objective.objective")
        .findOne({
          where: { id: objectiveId },
        });

      if (!objective) {
        ctx.throw(400, `This objective does not exist`);
      }
      if (!user_objectives[objective.id] && objective.requirement !== "login") {
        ctx.throw(400, `This objective is not started yet!`);
      }
      if (
        user_objectives[objective.id].progress < objective.requirement_amount &&
        objective.requirement !== "login"
      ) {
        ctx.throw(400, `This objective is not completed yet!`);
      }

      // SAVE PROGRESS
      const updated_user_objectives = {
        ...user_objectives,
        [objective.id]: {
          isCollected: true,
          progress: objective.requirement !== "login" ? 0 : 1,
        },
      };

      const payload = { objectives_json: updated_user_objectives };
      console.log(payload);

      const data = await updateUser(user.id, payload);

      // GAIN REWARDS SERVICE TRIGGER
      const rewardType = objective.reward_type;
      const quantity = objective.reward_amount;

      const updatedRewards = await strapi
        .service("api::usercard.usercard")
        .gainReward(user, rewardType, quantity);

      return {
        user_objectives: data.objectives_json,
        updatedRewards,
      };
    },
    // DONE
    async openPack(ctx) {
      const user = await getUser(ctx.state.user.id);
      const boxId = parseInt(ctx.params.id);

      const lootBox = await strapi.db.query("api::box.box").findOne({
        where: { id: boxId },
        populate: {
          expansion: {
            populate: {
              cards: true,
            },
          },
          image: true,
        },
      });

      const boxCount = user.boxes[boxId];

      if (!boxCount) {
        return ctx.throw(400, "You have 0 loot boxes");
      }

      if (boxCount < 1) {
        return ctx.throw(400, "You have 0 loot boxes");
      }

      const filterBy = (array, value, identifier = "id") => {
        return array.filter((item) => item[identifier] === value)[0];
      };

      const hasExpansion = filterBy(
        user.expansions,
        lootBox.expansion.id,
        "id"
      );

      // hardcore 2... pro expansion @newexp
      if (!hasExpansion && lootBox.expansion.id === 2) {
        return ctx.throw(400, "You do not have this expansion purchased yet.");
      }

      // ALL GOOD -> EXECUTE LOGIC
      const upload = {
        boxes: {
          ...user.boxes,
          [boxId]: user.boxes[boxId] - 1,
        },
      };

      await updateUser(user.id, upload);

      const cards = lootBox.expansion.cards;

      const generateRandomCards = (cards, size) => {
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

        const generateRandomCard = (cards, fixedRarity = "") => {
          const rarity = fixedRarity ? fixedRarity : determineRarity();
          const filteredCards = cards.filter((c) => c.rarity === rarity);
          const random = Math.floor(Math.random() * filteredCards.length);
          return filteredCards[random];
        };

        const result = [];
        for (let i = 0; i < size; i++) {
          const droppedCard = generateRandomCard(cards);
          result.push(droppedCard);
        }
        return result;
      };

      const getRandomQuantity = (min, max) => {
        return Math.floor(Math.random() * (max - min + 1) + min);
      };

      // 3 can be variable set from lootbox example: lootbox.drop_amount
      const cardsDropped = generateRandomCards(cards, 3);

      async function updateUserRelations(cardsDropped) {
        const results = [];
        for (const card of cardsDropped) {
          const updatedCard = await strapi
            .service("api::usercard.usercard")
            .gainCard(
              user,
              { card: card, quantity: getRandomQuantity(3, 6) }, // payload
              "fromBox"
            );
          results.push(updatedCard);
        }
        return results;
      }

      const data = await updateUserRelations(cardsDropped);

      const cardIds = data.map((c) => c.card);

      const cardDetails = await strapi.db.query("api::card.card").findMany({
        where: {
          id: {
            $in: cardIds,
          },
        },
        populate: {
          realm: {
            populate: { image: true },
          },
          image: true,
        },
      });

      const finalResult = data.map((c) => {
        const oldCard = c;
        const cardDetailsById = cardDetails.filter(
          (card) => card.id === c.card
        )[0];
        oldCard.card = cardDetailsById;
        return oldCard;
      });

      const finalData = {
        box: lootBox,
        results: finalResult,
      };
      // trigger achievement api
      await strapi
        .service("api::usercard.usercard")
        .achievementTrigger(user, "open_pack");

      return { data: finalData };
    },
    // DONE
    async purchaseLootBox(ctx) {
      const user = await getUser(ctx.state.user.id);
      const boxId = ctx.params.id;

      const lootBox = await strapi.db.query("api::box.box").findOne({
        where: { id: boxId },
        // populate: { expansions: true, cards: true },
      });

      let userStarsBalance = user.stars;
      let userGemsBalance = user.gems;

      if (lootBox.price_type === "stars") {
        if (user.stars < lootBox.price) {
          ctx.throw(400, `You do not have enough stars.`);
          return;
        }
        userStarsBalance = userStarsBalance - lootBox.price;
      }

      if (lootBox.price_type === "gems") {
        if (user.gems < lootBox.price) {
          ctx.throw(400, `You do not have enough gems.`);
          return;
        }
        userGemsBalance = userGemsBalance - lootBox.price;
      }

      await strapi
        .service("api::usercard.usercard")
        .gainReward(user, `box_${boxId}`);

      const upload = {
        stars: userStarsBalance,
        gems: userGemsBalance,
      };

      const download = await updateUser(user.id, upload);

      const data = {
        stars: download.stars,
        gems: download.gems,
        box: lootBox,
      };
      return data;
    },
    // DONE
    async purchaseExpansion(ctx) {
      const user = await getUser(ctx.state.user.id);
      const expansionId = parseInt(ctx.params.id);

      const expansion = await strapi.db
        .query("api::expansion.expansion")
        .findOne({
          where: { id: expansionId },
        });

      if (expansion.id === 1) {
        ctx.throw(400, `This is a Basic Expansion, you already have it!`);
        return;
      }

      if (!expansion) {
        ctx.throw(400, `This expansion does not exist.`);
        return;
      }

      if (user.expansions.filter((e) => e.id === expansionId).length > 0) {
        ctx.throw(400, `You already have this expansion.`);
        return;
      }

      if (user.gems < expansion.price) {
        ctx.throw(400, `You do not have enough gems.`);
        return;
      }

      const upload = {
        gems: user.gems - expansion.price,
        expansions: [...user.expansions, expansionId],
      };

      const download = await updateUser(user.id, upload);

      const data = {
        gems: download.gems,
        expansion: expansion,
      };

      return data;
    },
    // DONE
    async purchaseProduct(ctx) {
      const user = await getUser(ctx.state.user.id, {
        orders: {
          populate: {
            product: true,
          },
        },
      });

      const productId = ctx.params.id;

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

      // IF PRODUCT === GEMS
      if (product.type === "gems") {
        const newOrder = await strapi
          .service("api::usercard.usercard")
          .createOrder(user, product, API);

        const upload = { gems: user.gems + product.amount };
        await updateUser(user.id, upload);

        const data = {
          newOrder,
          gems: user.gems + product.amount,
        };
        return data;
        // "GEMS_PURCHASE_SUCCESS"
      }

      // IF PRODUCT === BUNDLE
      if (product.type === "bundle") {
        const hasBundle =
          user.orders.filter((order) => order.product.id === product.id)
            .length > 0;

        if (hasBundle) {
          return ctx.badRequest("You have already purchased this bundle.");
        }

        for (let i = 0; i < product.bundle.length; i++) {
          await strapi
            .service("api::usercard.usercard")
            .gainReward(
              user,
              product.bundle[i].type,
              product.bundle[i].quantity
            );
        }

        const newOrder = await strapi
          .service("api::usercard.usercard")
          .createOrder(user, product, API);

        // BUNDLE_PURCHASE_SUCCESS
        return newOrder;
      }

      // IF PRODUCT === SUBSCRIPTION
      if (product.type === "subscription") {
        if (user.is_subscribed) {
          return ctx.badRequest("You are already subscribed.");
        }

        const upload = {
          is_subscribed: true,
          subscription_date: Date.now(),
        };

        const updatedUser = updateUser(user.id, upload);

        const newOrder = await strapi
          .service("api::usercard.usercard")
          .createOrder(user, product, API);

        const data = {
          newOrder,
          is_subscribed: updatedUser.is_subscribed,
        };

        // SUBSCRIPTION_PURCHASE_SUCCESS
        return data;
      }
    },
    // DONE
    async followBuddy(ctx) {
      const user = await getUser(ctx.state.user.id, { followers: true });

      const buddyId = parseInt(ctx.params.id);

      const buddy = await getUser(buddyId);

      if (!buddy) {
        return ctx.badRequest("Buddy doesn't exist.");
      }

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

      const data = await updateUser(user.id, upload, { followers: true });
      const sanitizedData = data.followers.map((user) => {
        return { id: user.id, username: user.username };
      });
      return sanitizedData;
    },
    // DONE
    async cancelSubscription(ctx) {
      const user = await getUser(ctx.state.user.id);

      const isUnsubscribed = user.is_subscription_cancelled;
      const isPremium = user.is_subscribed;

      if (isUnsubscribed || !isPremium) {
        return ctx.badRequest(
          "Your subscription is cancelled or doesn't exist."
        );
      }

      const upload = { is_subscription_cancelled: true };
      const data = await updateUser(user.id, upload);
      return data.is_unsubscribed;
    },
  })
);
