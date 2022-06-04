"use strict";

/**
 *  action controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::action.action", ({ strapi }) => ({
  async complete(ctx) {
    const user = ctx.state.user || { id: 1 };

    const actionId = parseInt(ctx.params.id);
    const { intent } = ctx.request.body;

    const action = await strapi.db.query("api::action.action").findOne({
      where: { id: actionId },
      populate: { card: true },
    });

    if (!action) {
      return ctx.throw(400, "This action doesn't exist.");
    }

    if (intent !== "complete" && intent !== "remove_complete") {
      return ctx.throw(400, "This intent doesn't exist");
    }

    const usercard = await strapi.db.query("api::usercard.usercard").findOne({
      where: { user: user.id, card: action.card.id },
      populate: true,
    });

    let usercardUpload;

    if (intent === "complete") {
      usercardUpload = {
        completed_actions: [...usercard.completed_actions, actionId],
      };
    }

    if (intent === "remove_complete") {
      const newActions = usercard.completed_actions.filter(
        (a) => a.id !== actionId
      );
      usercardUpload = {
        completed_actions: newActions,
      };
    }

    const usercardData = await strapi.db
      .query("api::usercard.usercard")
      .update({
        where: { id: usercard.id },
        data: usercardUpload,
        populate: true,
      });

    return {
      data: usercardData.completed_actions,
      notification: "ACTION_UPDATED",
    };
  },
  async test(ctx) {
    const entry = await strapi.db
      .query("plugin::users-permissions.user")
      .update({
        where: { id: 3 },
        data: {
          username: "Satkar",
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
    console.log(entry);
    return entry;
  },
}));
