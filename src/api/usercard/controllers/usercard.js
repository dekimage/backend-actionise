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
  const defaultPopulate = { usercards: true, orders: true };
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
    async resetUser(ctx) {
      const user = ctx.state.user;
      let payload = {
        objectives_json: {
          1: { progress: 5, isCollected: false },
          2: { progress: 5, isCollected: false },
          3: { progress: 5, isCollected: false },
          4: { progress: 5, isCollected: false },
          5: { progress: 5, isCollected: false },
          6: { progress: 5, isCollected: false },
          7: { progress: 5, isCollected: false },
          8: { progress: 5, isCollected: false },
        },
        streak_rewards: {},
        friends_rewards: {},
        rewards_tower: {},
      };
      const data = updateUser(user.id, payload);
      return data;
    },
    async acceptReferral(ctx) {
      const user = await getUser(ctx.state.user.id, { shared_by: true });
      // update self
      if (user.is_referral_accepted) {
        ctx.throw(400, "You already claimed this reward");
      }
      const upload = {
        is_referral_accepted: true,
        stars: user.stars + 400,
      };

      await updateUser(user.id, upload);

      const sharedUserId = user.shared_by.id;
      console.log(sharedUserId);

      const sharedUser = await getUser(sharedUserId, { shared_buddies: true });

      // update the shared user
      const sharedUpload = {
        highest_buddy_shares: sharedUser.highest_buddy_shares + 1,
        // shared_buddies: [...sharedUser.shared_buddies, sharedUserId],
      };

      await updateUser(sharedUserId, sharedUpload);
      return { success: true };
    },
    //DONE
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
      const cards_count = await strapi.db.query("api::card.card").count();

      const levelRewards = await strapi.db
        .query("api::levelreward.levelreward")
        .findMany({
          where: {
            level: {
              $lt: user.level + 2,
            },
          },
        });

      const today = new Date();
      const isRestarted = formatDate(today) === user.reset_date;
      // console.log({ isRestarted, userresetdate: user.reset_date });

      //week implement
      const weekResetDate =
        user.reset_week_date || today.getTime() + 7 * 24 * 60 * 60 * 1000;
      const isWeekRestarted = today.getTime() >= weekResetDate;

      if (!isRestarted) {
        const resetUser = await updateUser(user.id, {
          energy: user.energy <= 3 ? 3 : user.energy,
          reset_date: formatDate(today),
          reset_week_date: isWeekRestarted
            ? today.getTime() + 7 * 24 * 60 * 60 * 1000
            : !user.reset_week_date
            ? today.getTime() + 7 * 24 * 60 * 60 * 1000
            : user.reset_week_date,
          objectives_json: {
            ...user.objectives_json,
            8: { progress: 1, isCollected: false },
            9: { progress: 0, isCollected: false },
            10: { progress: 0, isCollected: false },
            11: { progress: 0, isCollected: false },
            12: isWeekRestarted
              ? { progress: 0, isCollected: false }
              : user.objectives_json[12],
            13: isWeekRestarted
              ? { progress: 0, isCollected: false }
              : user.objectives_json[13],
            14: isWeekRestarted
              ? { progress: 0, isCollected: false }
              : user.objectives_json[14],
          },
        });
      }
      const data = await getUser(user.id, {
        usercards: {
          populate: {
            card: true,
          },
        },
        favorite_actions: {
          populate: true,
        },
        favorite_cards: {
          populate: true,
        },
        levelrewards: {
          populate: true,
        },
        artifacts: {
          populate: true,
        },
        avatar: {
          populate: {
            image: true,
          },
        },
        claimed_artifacts: {
          populate: true,
        },
        actions: {
          populate: true,
          populate: {
            image: true,
            steps: true,
            stats: true,
            card: {
              populate: {
                realm: true,
              },
            },
          },
        },

        orders: true,

        shared_by: true,
        shared_buddies: {
          populate: {
            avatar: {
              populate: {
                image: true,
              },
            },
          },
        },
        last_unlocked_cards: true,
        last_completed_cards: true,
        followers: {
          populate: {
            image: true,
          },
        },
        followedBy: true,
      });
      const userDataModified = {
        ...data,
        artifacts_count,
        cards_count,
        levelRewards,
      };
      return userDataModified;
    },
    // DONE
    async updateCard(ctx) {
      const user = await getUser(ctx.state.user.id, {
        last_completed_cards: true,
        last_unlocked_cards: true,
        actions: true,
        favorite_actions: true,
        favorite_cards: true,
        artifacts: true,
      });

      const card_id = parseInt(ctx.params.id);
      const action = ctx.request.body.action;
      if (
        action !== "complete" &&
        action !== "unlock" &&
        action !== "favorite_card" &&
        action !== "complete_action" &&
        action !== "favorite_action"
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
    async updateTutorial(ctx) {
      const user = await getUser(ctx.state.user.id);
      const tutorialStep = ctx.params.tutorialStep;
      if (!tutorialStep || tutorialStep < 0 || tutorialStep > 10) {
        return ctx.badRequest("Invalid Tutorial Step");
      }
      const upload = {
        tutorial_step: tutorialStep,
      };

      const data = await updateUser(user.id, upload);
      return data.tutorial_step;
    },
    // DONE
    async collectStreakReward(ctx) {
      const user = await getUser(ctx.state.user.id, {
        shared_buddies: true,
        artifacts: true,
      });

      const streakCount = ctx.params.id;

      const streakReward = await strapi.db
        .query("api::streakreward.streakreward")
        .findOne({
          where: { streak_count: streakCount },
          populate: { reward_card: true, artifact: true },
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

      const data = await updateUser(user.id, upload);
      // GAIN REWARDS SERVICE TRIGGER

      let updatedRewards;

      // GAIN STARS
      if (streakReward.reward_type === "stars") {
        updatedRewards = await strapi
          .service("api::usercard.usercard")
          .gainReward(user, "stars", streakReward.reward_amount);

        return {
          streak_count: data.streak_count,
          updatedRewards,
        };
      }

      // GAIN CARD
      if (streakReward.reward_type === "card") {
        const payload = {
          card: streakReward.reward_card,
          quantity: streakReward.reward_amount,
        };

        updatedRewards = await strapi
          .service("api::usercard.usercard")
          .gainCard(user, payload, true);

        return {
          streak_count: data.streak_count,
          updatedRewards,
        };
      }

      // GAIN ARTIFACT
      if (streakReward.reward_type === "artifact") {
        updatedRewards = await strapi
          .service("api::usercard.usercard")
          .gainArtifact(user, streakReward.artifact.id);

        // RETURN MODAL
        return {
          modal: [
            {
              type: "rewards",
              data: { stars: updatedRewards },
            },
            {
              type: "artifact",
              data: streakReward.artifact,
            },
          ],
          streak_count: data.streak_count,
          updatedRewards,
          modal: streakReward.artifact && {
            data: streakReward.artifact,
            type: "artifact",
          },
        };
      }
    },
    // DONE
    async collectFriendsReward(ctx) {
      // static data
      const user = await getUser(ctx.state.user.id, {
        shared_buddies: true,
        artifacts: true,
      });

      const friendsCount = ctx.params.id;

      const friendsReward = await strapi.db
        .query("api::friendreward.friendreward")
        .findOne({
          where: { friends_count: friendsCount },
          populate: { reward_card: true, artifact: true },
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

      let updatedRewards;

      // TODO: ADD HERE WAY TO GAIN PREMIUM DAYS OR ORBS FOR BOTH USERS

      // GAIN REWARDS SERVICE TRIGGER
      if (friendsReward.artifact) {
        updatedRewards = await strapi
          .service("api::usercard.usercard")
          .gainArtifact(user, friendsReward.artifact.id);
      }

      // GAIN REWARDS SERVICE TRIGGER
      // if (!friendsReward.artifact) {
      //   const payload = {
      //     card: friendsReward.reward_card,
      //     quantity: friendsReward.reward_amount,
      //   };

      //   updatedRewards = await strapi
      //     .service("api::usercard.usercard")
      //     .gainCard(user, payload, true);
      // }
      // RETURN MODAL
      return {
        friends_count: data.friends_count,
        updatedRewards,
        modal: friendsReward.artifact && {
          data: friendsReward.artifact,
          type: "artifact",
        },
      };
    },
    // DONE
    async collectLevelReward(ctx) {
      // static data
      const user = await getUser(ctx.state.user.id, {
        artifacts: true,
        levelrewards: true,
      });

      const levelId = ctx.params.id;

      const levelReward = await strapi.db
        .query("api::levelreward.levelreward")
        .findOne({
          where: { id: levelId },
          populate: { artifact: true },
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
        levelrewards: [...user.levelrewards, levelReward.id],
      };

      const data = await updateUser(user.id, upload);

      // GAIN ARTIFACT IF THERE IS ONE

      let updatedRewards;

      console.log(levelReward);

      if (levelReward.reward_type === "artifact") {
        updatedRewards = await strapi
          .service("api::usercard.usercard")
          .gainArtifact(user, levelReward.artifact.id);
      }

      // GAIN REWARDS SERVICE TRIGGER
      if (!levelReward.reward_type === "artifact") {
        const rewardType = levelReward.reward_type;
        const quantity = levelReward.reward_amount;

        updatedRewards = await strapi
          .service("api::usercard.usercard")
          .gainReward(user, rewardType, quantity);
      }

      return {
        rewards_tower: data.rewards_tower,
        updatedRewards,
        modal: levelReward.artifact && {
          data: levelReward.artifact,
          type: "artifact",
        },
      };
    },
    // DONE
    async claimArtifact(ctx) {
      const artifactId = ctx.params.id;
      const user = await getUser(ctx.state.user.id, {
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

      const data = updateUser(user.id, upload, { claimed_artifacts: true });
      return data;
    },
    async claimObjective(ctx) {
      const objectiveId = ctx.params.id;
      const user = await getUser(ctx.state.user.id, { artifacts: true });
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

      if (objective.is_premium && !user.is_subscribed) {
        ctx.throw(400, `This objective requires a premium subscription`);
      }

      // objectives trigger for daily/weekly
      await strapi
        .service("api::usercard.usercard")
        .objectivesTrigger(
          user,
          objective.time_type === "daily" ? "daily" : "weekly"
        );

      // SAVE PROGRESS
      const updated_user_objectives = {
        ...user_objectives,
        [objective.id]: {
          isCollected: true,
          progress: objective.requirement !== "login" ? 0 : 1,
        },
      };

      let payload = { objectives_json: updated_user_objectives };
      if (
        objective.requirement !== "login" &&
        user.streak >= (user.highest_streak_count || 0)
      ) {
        payload = {
          objectives_json: updated_user_objectives,
          highest_streak_count: (user.highest_streak_count || 0) + 1,
        };
      }

      const data = await updateUser(user.id, payload);

      // GAIN REWARDS SERVICE TRIGGER
      const objectiveRewards = await strapi
        .service("api::usercard.usercard")
        .gainObjectiveRewards(user, objective);

      // artifact trigger
      const artifactData = await strapi
        .service("api::usercard.usercard")
        .achievementTrigger(
          user,
          objective.time_type === "daily"
            ? "daily_objectives_complete"
            : "weekly_objectives_complete"
        );

      return {
        user_objectives: data.objectives_json,
        rewards: objectiveRewards,
        artifactTrigger: artifactData,
      };
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

      // IF PRODUCT === STARS
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
    async saveAvatar(ctx) {
      const user = await getUser(ctx.state.user.id);
      const avatarId = parseInt(ctx.params.id);

      const avatar = await strapi.db.query("api::avatar.avatar").findOne({
        where: {
          id: avatarId,
        },
      });

      if (!avatar) {
        ctx.throw(400, "Avatar Image does not exist.");
      }

      // check if he can equip avatar ->
      const upload = {
        avatar: avatar.id,
      };
      const data = updateUser(user.id, upload);
      return data;
    },
  })
);
