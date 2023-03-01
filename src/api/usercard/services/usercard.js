"use strict";

const { createCoreService } = require("@strapi/strapi").factories;

const addIntegerInArray = (array, integer) => {
  if (array.includes(integer)) {
    return array;
  } else {
    array.push(integer);
    return array;
  }
};

const resetUserObjectives = async (user_json, isWeekRestarted) => {
  //arr = objectives real
  const arr = await strapi.db.query("api::objective.objective").findMany();

  var obj = {};
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].time_type == "daily") {
      const calcProgress = arr[i].requirement == "login" ? 1 : 0;
      obj[arr[i].id] = { progress: calcProgress, isCollected: false };
    }
    if (arr[i].time_type == "weekly") {
      if (isWeekRestarted) {
        obj[arr[i].id] = { progress: 0, isCollected: false };
      } else {
        obj[arr[i].id] = user_json[arr[i].id];
      }
    }
  }
  return obj;
};

const calculateWeekReset = (user, today) => {
  const weekResetDate =
    user.reset_week_date || today.getTime() + 7 * 24 * 60 * 60 * 1000;
  const isWeekRestarted = today.getTime() >= weekResetDate;
  const resetWeekDate = isWeekRestarted
    ? today.getTime() + 7 * 24 * 60 * 60 * 1000
    : !user.reset_week_date
    ? today.getTime() + 7 * 24 * 60 * 60 * 1000
    : user.reset_week_date;
  return { resetWeekDate, isWeekRestarted };
};

const determineRarity = () => {
  const drop_table = {
    common: 60,
    rare: 85,
    epic: 95,
    legendary: 100,
  };
  const randomNumber = Math.floor(Math.random() * 101);
  for (const rarity in drop_table) {
    if (randomNumber <= drop_table[rarity]) {
      return rarity;
    }
  }
};

const starAmountByRarity = {
  common: 25,
  rare: 50,
  epic: 100,
  legendary: 200,
};

function getRandomStars() {
  const rarity = determineRarity();
  const stars = starAmountByRarity[rarity];
  return stars;
}
// @calc
function getXpLimit(level) {
  return 100 + level * 10 * 1.6;
}

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
  populate = { usercards: true, orders: true }
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
  resetUser: async (user, today, formatDate) => {
    const { resetWeekDate, isWeekRestarted } = calculateWeekReset(user, today);

    await updateUser(user.id, {
      energy: user.energy <= 3 ? 3 : user.energy,
      card_tickets: [],
      action_tickets: [],
      reset_date: formatDate(today),
      reset_week_date: resetWeekDate,
      objectives_json: await resetUserObjectives(
        user.objectives_json,
        isWeekRestarted
      ),
    });
  },
  gainObjectiveRewards: async (user, objective) => {
    let payload = {};
    let artifactData = false;
    let starsGained; // for return to frontend only

    //1. XP (daily + 50, weekly + 250)
    const xpPerObjective = { daily: 50, weekly: 250 };
    const xpGained = xpPerObjective[objective.time_type];
    const xpLimit = getXpLimit(user.level);

    if (user.xp + xpGained > xpLimit) {
      payload = {
        xp: user.xp + xpGained - xpLimit,
        level: user.level + 1,
      };
    } else {
      payload = {
        xp: user.xp + xpGained,
      };
    }

    //1.5 Streak (objective reward = streak)
    if (objective.reward_type === "streak") {
      payload = {
        ...payload,
        streak: user.streak + 1,
      };
    }

    //2. Objective reward = stars or lootbox
    if (objective.reward_type === "stars") {
      payload = {
        ...payload,
        stars: user.stars + objective.reward_amount,
      };
      starsGained = objective.reward_amount;
    }

    //3. if lootbox - add stars + artifact %
    if (objective.reward_type === "loot") {
      //3.1. gain random stars
      const randomStars = getRandomStars();
      payload = {
        ...payload,
        stars: user.stars + randomStars,
      };
      starsGained = randomStars;

      //3.2. gain artifact maybe 16.6% chance
      const chanceToGainArtifact = 0.166;
      const randomInt = Math.random();
      // const shouldGainArtifact = randomInt >= chanceToGainArtifact;
      const shouldGainArtifact = true;

      if (shouldGainArtifact) {
        artifactData = await strapi
          .service("api::usercard.usercard")
          .gainArtifact(user, 0, true);
      }
    }

    // wait
    const data = await updateUser(user.id, payload);

    //MODALS CAN BE ARRAY -> CONSTRUCTED WAY

    return {
      xp: xpGained,
      level: payload.level,
      stars: starsGained,
      isLevelnew: user.xp + xpGained > xpLimit,
      artifact: artifactData.artifact,
    };

    //2. Objective reward (stars/lootbox/...?)
    //3. if lootbox - add stars + artifact %
  },
  gainReward: async (user, rewardType, quantity) => {
    const payload = {
      [rewardType]: user[rewardType] + quantity,
    };
    const data = await updateUser(user.id, payload);
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
            rarity: determineRarity(),
            type: "random",
          },
          populate: {
            image: true,
          },
        });

      // console.log(artifactsByRarity);
      // console.log(determineRarity());

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

    // console.log("artifact id", artifactId);

    // GENERIC GAIN ARTIFACT
    const hasArtifact =
      user.artifacts.filter((a) => a.id === artifactId).length > 0;

    if (hasArtifact) {
      return false;
      // return ctx.badRequest("You already have that artifact");
    }
    // console.log("user artifacts, ", user.artifacts);
    // console.log("artifactId, ", artifactId);
    const upload = { artifacts: [...user.artifacts, artifactId] };

    const data = await updateUser(user.id, upload, { artifacts: true });

    return {
      // modal: { data: rewardArtifact, type: "artifact" },
      artifact: rewardArtifact,
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

      // populate: {
      //   days: {
      //     contents: true,
      //   },
      // },
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
              completed_contents: [],
            },
          });
        return newUserCardRelation;
      }
      return checkUserCardRelation;
    }
    // 0. COMPLETE ACTION
    if (action === "complete_action") {
      const hasActionTicket = true; // TODO: change it to check real ticket
      if (hasActionTicket) {
        //update recently completed
        let newRecentActions = user.last_completed_actions || [];
        newRecentActions.push(card_id);
        if (newRecentActions.length > 10) {
          newRecentActions.shift();
        }
        const update = {
          last_completed_actions: newRecentActions,
        };
        const recentActionsUpdate = updateUser(user.id, update);

        //update objectives
        await strapi
          .service("api::usercard.usercard")
          .objectivesTrigger(user, "action");

        //artifact trigger
        const artifactData = await strapi
          .service("api::usercard.usercard")
          .achievementTrigger(user, "action_complete");

        return {
          modal: artifactData && {
            artifactData: artifactData.artifactData,
            stats: artifactData.data,
          },
        };
      }
    }

    // 0.5. ========== Action Trigger Favorite ON/OFF
    if (action === "favorite_action") {
      // card_id = action id actually
      let newFavoriteActions = user.favorite_actions || [];

      const alreadyFavorite =
        newFavoriteActions.length > 0 &&
        newFavoriteActions.filter((a) => a.id == card_id).length > 0;

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
      const checkUserCardRelation = await strapi.db
        .query("api::usercard.usercard")
        .findOne({ where: { user: user.id, card: card_id } });
      if (!!checkUserCardRelation) {
        return ctx.throw(400, `You already have this card unlocked.`);
      }
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
      const artifactData = await strapi
        .service("api::usercard.usercard")
        .achievementTrigger(user, "card_unlock");
      return {
        usercard: newUserCardRelation,
        modal: artifactData && {
          artifactData: artifactData.artifactData,
          stats: artifactData.data,
        },
      };
    }

    // check user relation for other actions...
    const userCardRelation = await generateUserCardRelation();
    if (!userCardRelation) {
      ctx.throw(400, `You do not have this card yet.`);
      return;
    }

    // 1.75 ========= COMPLETE A CONTENT
    if (action === "complete_contents") {
      if (typeof parseInt(contentIndex) !== "number") {
        ctx.throw(400, "invalid index sent");
      }

      const updatedUserRelation = addIntegerInArray(
        userCardRelation.completed_contents || [],
        contentIndex
      );

      const update = {
        completed_contents: updatedUserRelation,
      };

      const usercardUpdated = await strapi.db
        .query("api::usercard.usercard")
        .update({
          where: { user: user.id, card: card_id },
          data: update,
        });

      return usercardUpdated;
    }

    // 2. ========== COMPLETE A CARD:
    if (action === "complete") {
      if (
        userCardRelation.completed_contents?.length !==
        card.days[card.last_day || 0].contents.length
      ) {
        ctx.throw(400, "you havent completed all contents yet!");
      }

      function lessThan24HoursAgo(dateVariable) {
        if (!dateVariable) {
          return true;
        }
        const now = Date.now();
        const timeDiff = now - dateVariable;
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        return hoursDiff > 24;
      }

      if (lessThan24HoursAgo(userCardRelation.completed_at)) {
        // add to last completed - maybe as a servrice reusable?
        let new_last_completed = user.last_completed_cards;
        new_last_completed.push(card_id);
        if (new_last_completed.length > 10) {
          new_last_completed.shift();
        }
        const payload = { last_completed_cards: new_last_completed };
        await updateUser(user.id, payload);

        // add update League feature

        const updatedCompleted = userCardRelation.completed + 1;

        const leagues = [
          { min: 0, max: 2, league: "unranked" },
          { min: 3, max: 5, league: "bronze" },
          { min: 6, max: 9, league: "silver" },
          { min: 10, max: 19, league: "gold" },
          { min: 20, max: 49, league: "platinum" },
          { min: 50, max: 99, league: "diamond" },
          { min: 100, max: 10000000, league: "grandmaster" },
        ];

        const findLeague = (completed) => {
          const league = leagues.filter(
            (l) => completed >= l.min && completed <= l.max
          )[0];
          return {
            league: league.league,
            max: league.max,
          };
        };

        const updatedLeague = findLeague(updatedCompleted).league;
        const updatedProgressMax = findLeague(updatedCompleted).max + 1;

        if (updatedLeague !== userCardRelation.league) {
          // trigger achievement for the league type
        }

        const update = {
          league: updatedLeague,
          completed_progress_max: updatedProgressMax,
          completed: updatedCompleted,
          completed_at: Date.now(),
          completed_contents: [],
        };

        const usercardUpdated = await strapi.db
          .query("api::usercard.usercard")
          .update({
            where: { user: user.id, card: card_id },
            data: update,
          });

        //update objectives
        await strapi
          .service("api::usercard.usercard")
          .objectivesTrigger(user, "complete");

        //update artifacts
        const artifactData = await strapi
          .service("api::usercard.usercard")
          .achievementTrigger(user, "cards_complete");
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

    // 3. ========== Trigger Favorite ON/OFF
    if (action === "favorite_card") {
      const update = {
        is_favorite: !userCardRelation.is_favorite,
      };
      const data = await strapi.db.query("api::usercard.usercard").update({
        where: { user: user.id, card: card_id },
        data: update,
      });

      // EXTRA LOGIC DUPL;ICATE TO SAVE FAVORITE

      let newFavoriteCards = user.favorite_cards || [];

      const alreadyFavorite =
        newFavoriteCards.length > 0 &&
        newFavoriteCards.filter((a) => a.id == card_id).length > 0;

      if (alreadyFavorite) {
        newFavoriteCards = newFavoriteCards.filter((a) => a.id != card_id);
      } else {
        newFavoriteCards.push(card_id);
      }
      console.log(newFavoriteCards);
      const userUpdate = {
        favorite_cards: newFavoriteCards,
      };
      const userData = updateUser(user.id, userUpdate);

      return data;
    }
  },
  achievementTrigger: async (user, requirement) => {
    let user_stats = user.stats || {
      claimed_artifacts: 0,
      cards_complete: 0,
      action_complete: 0,
      card_unlock: 0,
      daily_objectives_complete: 0,
      weekly_objectives_complete: 0,
    };
    // @MATH
    const artifactTable = {
      cards_complete: [1, 2],
      action_complete: [1, 2],
      card_unlock: [1, 2],
      daily_objectives_complete: [1, 2],
      weekly_objectives_complete: [1, 2],
    };

    if (!artifactTable[requirement]) {
      console.log("wrong type name??");
      return false;
    }

    const statUpdated = user_stats[requirement] + 1;
    const shouldGainArtifact =
      artifactTable[requirement].filter((req) => req === statUpdated).length >
      0;

    let artifact = false;
    if (shouldGainArtifact) {
      artifact = await strapi.db.query("api::artifact.artifact").findOne({
        where: { type: requirement, require: statUpdated },
      });

      const artifactData = await strapi
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

    const data = await updateUser(user.id, upload);
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

    const data = await updateUser(user.id, upload);
    return {
      objectives_json: data.objectives_json,
    };
  },
}));
