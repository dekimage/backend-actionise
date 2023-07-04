"use strict";

const API_PATH = "api::usercard.usercard";

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
  common: 50,
  rare: 75,
  epic: 125,
  legendary: 250,
};

function getRandomStars() {
  const rarity = determineRarity();
  const stars = starAmountByRarity[rarity];
  return stars;
}

function getXpLimit(level) {
  //chatGPT - enhanced
  // @CEREBRO
  const INCREASE_PER_LEVEL = 3.29;
  const STARTING_XP = 300;

  function calculateXpValue(startingXp, increase, iteration) {
    let xp = startingXp;

    for (let i = 1; i < iteration; i++) {
      xp += Math.ceil(xp * (increase / 100));
    }

    return xp;
  }
  return calculateXpValue(STARTING_XP, INCREASE_PER_LEVEL, level);
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

// @CEREBRO
function singularize(word) {
  switch (word) {
    case "ideas":
      return "idea";
    case "actions":
      return "exercise";
    case "stories":
      return "story";
    case "faq":
      return "faq"; // this is already singular
    case "program":
      return "program"; // this is already singular
    case "casestudy":
      return "casestudy"; // this is already singular
    case "tips":
      return "tip";
    case "metaphors":
      return "metaphore";
    case "experiments":
      return "experiment";
    case "expertOpinions":
      return "expertopinion";
    case "quotes":
      return "quote";
    case "questions":
      return "question";
    default:
      return false;
  }
}

const updateUser = async (id, payload) => {
  const user = await strapi.db.query("plugin::users-permissions.user").update({
    where: { id: id },
    data: payload,
  });

  return sanitizeUser(user);
};

const getOrCreateUserCard = async (ctx, card, isForceCreate = false) => {
  const userId = ctx.state.user.id;

  const checkUserCardRelation = await strapi.db
    .query(API_PATH)
    .findOne({ where: { user: userId, card: card.id } });

  if ((!checkUserCardRelation && card.is_open) || isForceCreate) {
    const newUserCardRelation = await strapi.db.query(API_PATH).create({
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
    return newUserCardRelation;
  }
  if (!checkUserCardRelation && !card.is_open && !isForceCreate) {
    ctx.throw(403, "You have not unlocked this card yet");
  }
  return checkUserCardRelation;
};

module.exports = createCoreService("api::usercard.usercard", ({ strapi }) => ({
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

  resetUser: async (user, today, formatDate) => {
    const { resetWeekDate, isWeekRestarted } = calculateWeekReset(user, today);

    await updateUser(user.id, {
      // @CEREBRO
      energy: user.energy <= 3 ? 3 : user.energy,
      reset_date: formatDate(today),
      reset_week_date: resetWeekDate,
      objectives_json: await resetUserObjectives(
        user.objectives_json,
        isWeekRestarted
      ),
    });
  },

  gainContentQuestRewards: async (user, params) => {
    let payload = {};
    // @CEREBRO
    const xpGained = 50;
    const xpLimit = getXpLimit(user.level);

    if (user.xp + xpGained >= xpLimit) {
      payload = {
        xp: user.xp + xpGained - xpLimit,
        level: user.level + 1,
        xpLimit: getXpLimit(user.level + 1),
      };
    } else {
      payload = {
        xp: user.xp + xpGained,
      };
    }

    const starsGained = 25;
    payload = {
      ...payload,
      stars: user.stars + starsGained,
    };

    return {
      xp: payload.xp,
      xpGained: xpGained,
      level: payload.level,
      xpLimit: getXpLimit(payload.level),
      stars: starsGained,
      isLevelnew: user.xp + xpGained >= xpLimit,
      artifact: artifactData.artifact,
    };

    // NOT FINISHED
  },

  gainObjectiveRewards: async (user, objective) => {
    let payload = {};
    let artifactData = false;
    let starsGained; // for return to frontend only

    //1. XP (daily + 50, weekly + 250)
    // @CEREBRO
    const xpPerObjective = { daily: 75, weekly: 250 };
    const xpGained = xpPerObjective[objective.time_type];
    const xpLimit = getXpLimit(user.level);

    if (user.xp + xpGained >= xpLimit) {
      payload = {
        xp: user.xp + xpGained - xpLimit,
        level: user.level + 1,
        xpLimit: getXpLimit(user.level + 1),
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

      // @CEREBRO
      //3.2. gain artifact maybe 16.6% chance
      // const chanceToGainArtifact = 0.166;
      const chanceToGainArtifact = 0.99;
      const randomInt = Math.random();
      const shouldGainArtifact = randomInt <= chanceToGainArtifact;
      // const shouldGainArtifact = true;

      if (shouldGainArtifact) {
        artifactData = await strapi
          .service("api::usercard.usercard")
          .gainArtifact(user, 0, true);
      }
    }
    await updateUser(user.id, payload);

    return {
      xp: {
        xp: payload.xp,
        xpGained: xpGained,
        level: payload.level,
        xpLimit: getXpLimit(payload.level),
        isLevelnew: user.xp + xpGained >= xpLimit,
      },
      stars: starsGained,
      artifact: artifactData.artifact,
    };
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

    await updateUser(user.id, upload, { artifacts: true });

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
    });

    if (!card) {
      return ctx.throw(400, `Card not found`);
    }

    // 1 ======= UNLOCK A CARD
    if (action === "unlock") {
      const canUnlock = user.stars >= card.cost;
      if (!canUnlock) {
        return ctx.throw(
          400,
          `You do not have enough stars to unlock this card.`
        );
      }

      const usercard = await getOrCreateUserCard(ctx, card, true);

      const payload = {
        stars: user.stars - card.cost,
      };

      await updateUser(user.id, payload);

      const artifactData = await strapi
        .service("api::usercard.usercard")
        .achievementTrigger(user, "card_unlock");
      // @FIX MODAL

      console.log("artifactData", artifactData);

      return {
        usercard: usercard,
        rewards: { artifact: artifactData.artifactData },
      };
    }

    const userCardRelation = await getOrCreateUserCard(ctx, card);

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
        ctx.throw(400, "You havent completed all contents yet!");
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

        const update = {
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

        // update mastery
        await updateUser(user.id, {
          stats: { ...user.stats, mastery: user.stats.mastery + 1 },
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
      await updateUser(user.id, userUpdate);

      return data;
    }
  },

  achievementTrigger: async (user, requirement) => {
    // @CEREBRO
    let user_stats = user.stats || {
      claimed_artifacts: 0,
      cards_complete: 0,
      card_unlock: 0,
      daily_objectives_complete: 0,
      weekly_objectives_complete: 0,
    };
    // @CEREBRO
    const artifactTable = {
      cards_complete: [5, 10, 25, 50, 75, 100, 200, 300, 500, 1000],
      card_unlock: [3, 5, 10, 20, 30, 40],
      daily_objectives_complete: [15, 30, 75, 100, 150, 250],
      weekly_objectives_complete: [5, 15, 25],
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

  gainCard: async (ctx, card) => {
    await getOrCreateUserCard(ctx, card, true);
    return card;
  },

  getRandomUndroppedContent: async (user) => {
    //@CEREBRO
    const contentTypes = [
      "ideas",
      "actions", //   "exercises",
      "stories",
      "tips",
      "faq",
      "quotes",
      "casestudy",
      "metaphors",
      "expertOpinions",
      "questions",
      "experiments",
    ];

    const cardIds = user.unlocked_cards?.ids || [];

    while (contentTypes.length > 0) {
      const randomIndex = Math.floor(Math.random() * contentTypes.length);
      const randomContentType = contentTypes[randomIndex];
      contentTypes.splice(randomIndex, 1);

      const formattedContentType = singularize(randomContentType);

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
