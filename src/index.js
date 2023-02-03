"use strict";

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
      models: ["plugin::users-permissions.user"],

      // your lifecycle hooks
      async afterCreate(event) {
        const { result } = event;
        const user = await strapi.db
          .query("plugin::users-permissions.user")
          .update({
            where: { id: result.id },
            data: {
              reset_week_date: new Date().getTime() + 7 * 24 * 60 * 60 * 1000,
              highest_buddy_shares: 0,
              highest_streak_count: 0,
              objectives_json: await createNewUserObjectives(),
              rewards_tower: {
                1: false,
              },
              friends_rewards: {
                1: false,
              },
              streak_rewards: {
                1: false,
              },
              stats: {
                card_unlock: 0,
                cards_complete: 0,
                action_complete: 0,
                claimed_artifacts: 0,
                daily_objectives_complete: 0,
                weekly_objectives_complete: 0,
              },
            },
          });
        // await strapi.db.query("api::usercard.usercard").create({
        //   data: {
        //     user: user.id,
        //     card: 2,
        //     quantity: 1,
        //     completed: 0,
        //     glory_points: 0,
        //     is_unlocked: true,
        //     is_new: false,
        //     user_name: user.username,
        //   },
        // });
        return user;
      },
    });
  },
};
