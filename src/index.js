"use strict";

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
              highest_buddy_shares: 0,
              highest_streak_count: 0,
              boxes: {
                1: 1,
                2: 0,
                3: 0,
                4: 0,
              },
              objectives_json: {
                1: {
                  progress: 0,
                  isCollected: false,
                },
                2: {
                  progress: 0,
                  isCollected: false,
                },
                3: {
                  progress: 0,
                  isCollected: false,
                },
                4: {
                  progress: 0,
                  isCollected: false,
                },
                5: {
                  progress: 0,
                  isCollected: false,
                },
                6: {
                  progress: 0,
                  isCollected: false,
                },
                7: {
                  progress: 0,
                  isCollected: false,
                },
                8: {
                  progress: 0,
                  isCollected: false,
                },
              },
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
              rewards_tower: {
                1: false,
              },
              friends_rewards: {
                1: false,
              },
              streak_rewards: {
                1: false,
              },
            },
          });
        await strapi.db.query("api::usercard.usercard").create({
          data: {
            user: user.id,
            card: 1,
            quantity: 1,
            completed: 0,
            glory_points: 0,
            is_unlocked: true,
            is_new: false,
            user_name: user.username,
          },
        });
        return user;
      },
    });
  },
};
