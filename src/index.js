"use strict";

const { C_TYPES } = require("../utils/constants");

const createNewUserObjectives = async () => {
  //arr = objectives real
  const arr = await strapi.db.query("api::objective.objective").findMany();

  var obj = {};
  for (var i = 0; i < arr.length; i++) {
    const calcProgress = arr[i].requirement == "login" ? 1 : 0;
    obj[arr[i].id] = { progress: calcProgress, isCollected: false };
  }
  return obj;
};

const updateCardRelationCount = async (card, relation, count) => {
  let update = card.relationCount ? card.relationCount : {};
  console.log({ count }, update[relation]);
  const updateCount = update[relation] || 0 ? update[relation] + count : 1;
  console.log({ updateCount });
  update[relation] = updateCount;
  const updatedCard = await strapi.db.query("api::card.card").update({
    where: { id: card.id },
    data: {
      relationCount: update,
    },
  });
};

function createModelsArrayFromContentMap() {
  const modelsArray = [];

  // Iterate over each content type in the CONTENT_MAP
  for (const contentType in C_TYPES.CONTENT_MAP) {
    if (C_TYPES.CONTENT_MAP.hasOwnProperty(contentType)) {
      // Get the single content string from the content type information
      const content = C_TYPES.CONTENT_MAP[contentType].single;

      // Create the model string and add it to the modelsArray
      const modelString = `api::${content}.${content}`;
      modelsArray.push(modelString);
    }
  }
  modelsArray.push("plugin::users-permissions.user");
  return modelsArray;
}

const afterCreate = async (result) => {
  const user = await strapi.db.query("plugin::users-permissions.user").update({
    where: { id: result.id },
    data: {
      xpLimit: 300,
      reset_week_date: new Date().getTime() + 7 * 24 * 60 * 60 * 1000,
      highest_buddy_shares: 0,
      highest_streak_count: 0,
      avatar: 1,
      objectives_json: await createNewUserObjectives(),
      tutorial: {
        step: 1,
        progress: 0,
        isCompleted: false,
        calendar: {
          claimed_days: [],
          startDate: new Date(),
          isFinished: false,
        },
      },
      rewards_tower: {
        1: false,
      },
      friends_rewards: {
        1: false,
      },
      streak_rewards: {
        1: false,
      },
      unlocked_cards: [],
      stats: {
        mastery: 0,
        card_unlock: 0,
        cards_complete: 0,
        action_complete: 0,
        claimed_artifacts: 0,
        daily_objectives_complete: 0,
        weekly_objectives_complete: 0,
        first_bonus: false,
      },
      email_preferences: {
        newsletter: true,
        promotions: true,
        content: true,
        updates: true,
        reminders: true,
        unsubscribe: false,
      },
    },
  });

  // await strapi.db.query("api::usercard.usercard").create({
  //     //   data: {
  //     //     user: user.id,
  //     //     card: 2,
  //     //     quantity: 1,
  //     //     completed: 0,
  //     //     glory_points: 0,
  //     //     is_unlocked: true,
  //     //     is_new: false,
  //     //     user_name: user.username,
  //     //   },
  //     // });
  await strapi.service("api::usercard.usercard").sendEmailTemplate();
  return user;
};

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }) {
    strapi.db.lifecycles.subscribe({
      // models: ["api::idea.idea", "api::exercise.exercise"],
      models: createModelsArrayFromContentMap(),
      async afterCreate(event) {
        if (event.model.singularName === "user") {
          await afterCreate(event.result);
        } else {
          const card = event.result.card;
          await updateCardRelationCount(card, event.model.tableName, 1);
        }
      },
      async beforeDelete(event) {
        if (event.model.singularName === "user") {
          return;
        }
        const ids = [event.params.where.id];
        const cards = await strapi.db.query("api::card.card").findMany({
          where: { [event.model.tableName]: { id: { $in: ids } } },
        });
        console.log(cards[0]);
        await updateCardRelationCount(cards[0], event.model.tableName, -1);
      },
    });
  },
};
``;
