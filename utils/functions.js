const { TYPES, CONFIG, C_TYPES } = require("./constants");

const FUNCTIONS = {
  resetUserObjectives: async (user_json, timeType) => {
    const arr = await strapi.db.query("api::objective.objective").findMany();

    var obj = {};
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].time_type == TYPES.OBJECTIVE_TIME_TYPES.daily) {
        if (timeType == TYPES.OBJECTIVE_TIME_TYPES.daily) {
          const calcProgress =
            arr[i].requirement == TYPES.OBJECTIVE_REQUIREMENT_TYPES.login
              ? 1
              : 0;
          obj[arr[i].id] = { progress: calcProgress, isCollected: false };
        } else {
          obj[arr[i].id] = user_json[arr[i].id];
        }
      }
      if (arr[i].time_type == TYPES.OBJECTIVE_TIME_TYPES.weekly) {
        if (timeType == TYPES.OBJECTIVE_TIME_TYPES.weekly) {
          obj[arr[i].id] = { progress: 0, isCollected: false };
        } else {
          obj[arr[i].id] = user_json[arr[i].id];
        }
      }
    }

    return obj;
  },

  makePopulate: (keys) => {
    const result = {};

    keys.forEach((key) => {
      const levels = key.split(".");
      let currentObj = result;

      levels.forEach((level, index) => {
        if (!currentObj[level]) {
          if (index === levels.length - 1) {
            currentObj[level] = true;
          } else {
            currentObj[level] = { populate: {} };
          }
        }

        currentObj = currentObj[level].populate;
      });
    });

    return result;
  },

  lessThan24HoursAgo: (dateVariable) => {
    if (!dateVariable) {
      return true;
    }
    const now = Date.now();
    const timeDiff = now - dateVariable;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    return hoursDiff > 24;
  },

  getXpLimit: (level) => {
    const calculateXpValue = (startingXp, increase, iteration) => {
      let xp = startingXp;

      for (let i = 1; i < iteration; i++) {
        xp += Math.ceil(xp * (increase / 100));
      }

      return xp;
    };

    return calculateXpValue(
      CONFIG.STARTING_XP,
      CONFIG.INCREASE_PER_LEVEL,
      level
    );
  },

  determineRarity: () => {
    const randomNumber = Math.floor(Math.random() * 101);
    for (const rarity in CONFIG.RARITY_TABLE) {
      if (randomNumber <= CONFIG.RARITY_TABLE[rarity]) {
        return rarity;
      }
    }
  },

  getRandomStars: () => {
    const rarity = FUNCTIONS.determineRarity();
    const stars = CONFIG.STARS_BY_RARITY[rarity];
    return stars;
  },

  sanitizeUser: (user) => {
    delete user["provider"];
    delete user["password"];
    delete user["resetPasswordToken"];
    delete user["confirmationToken"];
    delete user["confirmed"];
    delete user["blocked"];
    delete user["updatedAt"];
    delete user["createdAt"];
    return user;
  },

  calculateWeekReset: (user, today) => {
    const weekResetDate =
      user.reset_week_date || today.getTime() + 7 * 24 * 60 * 60 * 1000;
    console.log(weekResetDate);
    const shouldWeekRestart = today.getTime() >= weekResetDate;
    const resetWeekDate = shouldWeekRestart
      ? today.getTime() + 7 * 24 * 60 * 60 * 1000
      : user.reset_week_date || today.getTime() + 7 * 24 * 60 * 60 * 1000;
    return { resetWeekDate, shouldWeekRestart };
  },

  formatDate: (date) => {
    const padTo2Digits = (num) => {
      return num.toString().padStart(2, "0");
    };
    return [
      date.getFullYear(),
      padTo2Digits(date.getMonth() + 1),
      padTo2Digits(date.getDate()),
    ].join("-");
  },

  createToken: (length) => {
    const chars = "0123456789";
    let token = "";

    for (let i = 0; i < length; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }

    return token;
  },
  updateRelationCountForAllCards: async () => {
    try {
      // Step 1: Query all Card records
      const allCards = await strapi.query("api::card.card").findMany();
      console.log(allCards);

      // Step 2: Process each Card record and update the relationCount
      for (const card of allCards) {
        let relationCount = {};
        // Step 2.1: Query all associated Idea records for the current Card
        for (const contentType in C_TYPES.CONTENT_MAP) {
          const singleContentType = C_TYPES.CONTENT_MAP[contentType].single;
          const count = await strapi.db
            .query(`api::${singleContentType}.${singleContentType}`)
            .count({ where: { card: { id: card.id } } });
          // console.log({ count, contentType });
          relationCount[contentType] = count;
        }
        // console.log({ FINAL: relationCount });

        // Step 2.2: Update the relationCount field on the Card model
        await strapi.query("api::card.card").update({
          where: { id: card.id },
          data: {
            relationCount,
          },
        });
      }

      console.log("Bulk update completed successfully.");
    } catch (error) {
      console.error("An error occurred during the bulk update:", error);
    }
  },
};

const STRAPI = {
  getUserCard: async (userId, cardId) => {
    const usercard = await strapi
      .query(CONFIG.API_PATH)
      .findOne({ where: { user: userId, card: cardId } });
    return usercard;
  },
  getUser: async (id, populate = {}) => {
    // const defaultPopulate = {
    //   usercards: true,
    //   orders: true,
    // };
    const entry = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({
        // select: ['title', 'description'],
        where: { id: id },
        populate: { ...populate },
      });
    return FUNCTIONS.sanitizeUser(entry);
  },
  updateUser: async function (id, payload, populate = {}) {
    // const defaultPopulate = { usercards: true, orders: true };
    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .update({
        where: { id: id },
        data: payload,
        // populate: { ...defaultPopulate, ...populate },
        populate: { ...populate },
      });

    return FUNCTIONS.sanitizeUser(user);
  },
  getOrCreateUserCard: async (ctx, card, isForceCreate = false) => {
    const userId = ctx.state.user.id;

    const checkUserCardRelation = await strapi.db
      .query(CONFIG.API_PATH)
      .findOne({ where: { user: userId, card: card.id } });

    if (!checkUserCardRelation && (card.is_open || isForceCreate || user.pro)) {
      const newUserCardRelation = await strapi.db
        .query(CONFIG.API_PATH)
        .create({
          data: {
            user: userId,
            card: card.id,
            completed: 0,
            is_unlocked: true,
            is_new: true,
            completed_contents: [],
            progressMap: {},
            progressQuest: {},
          },
        });

      await STRAPI.updateUser(ctx.state.user.id, {
        unlocked_cards: [...ctx.state.user.unlocked_cards, card.id],
      });
      return newUserCardRelation;
    }
    if (
      !checkUserCardRelation &&
      !card.is_open &&
      !isForceCreate &&
      !user.pro
    ) {
      ctx.throw(403, "You have not unlocked this card yet");
    }
    return checkUserCardRelation;
  },
  updateStats: async function (user, stat) {
    await this.updateUser(user.id, {
      stats: { ...user.stats, [stat]: user.stats[stat] + 1 },
    });
  },

  triggerTutorial: async function (user, event) {
    const { step, progress } = user.tutorial;

    if (TYPES.TUTORIAL_STEPS[event] == step) {
      await this.updateUser(user.id, {
        tutorial: {
          step: step,
          progress: progress + 1,
        },
      });
    }
    return;
  },

  testFind: async () => {
    const entry = await strapi.entityService.findMany("api::card.card", {
      fields: ["id"],
      populate: {
        actions: {
          fields: ["id"],
        },
      },
    });
    // console.log(entry);
    return entry;
  },
};

module.exports = { STRAPI, FUNCTIONS };
