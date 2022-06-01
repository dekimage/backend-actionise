"use strict";

/**
 *  communityaction controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::communityaction.communityaction",
  ({ strapi }) => ({
    async create(ctx) {
      const user = ctx.state.user || { id: 1 };
      const data = ctx.request.body;

      const usercard = await strapi.db.query("api::usercard.usercard").findOne({
        where: { user: user.id, card: data.card },
        populate: true,
      });

      if (!usercard) {
        return ctx.throw(400, "You can't create action for this card yet.");
      }

      if (usercard.my_community_actions.length > 4) {
        return ctx.throw(
          400,
          "You've reached the maximum number of actions you can create per card."
        );
      }

      if (data.name.length > 30) {
        return ctx.throw(
          400,
          "The action's name should not exeed 30 characters."
        );
      }
      if (data.duration > 60) {
        return ctx.throw(
          400,
          "The action's duration can't be longer than 60 minutes."
        );
      }

      const upload = {
        name: data.name,
        type: data.type,
        action: data.action,
        isPrviate: data.isPrviate,
        duration: parseInt(data.duration),
        card: data.card,
        user: user.id,
        usercard: usercard.id,
        steps: [{ content: "first step" }, { content: "second step" }],
      };

      const action = await strapi.db
        .query("api::communityaction.communityaction")
        .create({
          data: upload,
        });
      return action;
    },
    async delete(ctx) {
      const user = ctx.state.user || { id: 1 };
      const actionId = ctx.params.id;

      const action = await strapi.db
        .query("api::communityaction.communityaction")
        .findOne({
          where: { id: actionId },
          populate: true,
        });

      if (!action) {
        return ctx.throw(400, "This action doesn't exist.");
      }

      if (action.user.id !== user.id) {
        return ctx.throw(
          400,
          "You can't delete other's user's action! Bad dog."
        );
      }
      const data = await strapi.db
        .query("api::communityaction.communityaction")
        .delete({
          where: { id: actionId },
        });

      return data;
    },
    async interact(ctx) {
      const user = ctx.state.user || { id: 1 };

      const actionId = parseInt(ctx.params.id);
      const { intent } = ctx.request.body;

      const action = await strapi.db
        .query("api::communityaction.communityaction")
        .findOne({
          where: { id: actionId },
          populate: true,
        });

      if (
        intent !== "vote" &&
        intent !== "remove_vote" &&
        intent !== "report" &&
        intent !== "remove_report" &&
        intent !== "add" &&
        intent !== "remove_add" &&
        intent !== "complete" &&
        intent !== "remove_complete"
      ) {
        return ctx.throw(400, "This intent doesn't exist");
      }
      if (!action) {
        return ctx.throw(400, "This action doesn't exist.");
      }

      const usercard = await strapi.db.query("api::usercard.usercard").findOne({
        where: { user: user.id, card: action.card.id },
        populate: true,
      });

      if (!usercard) {
        return ctx.throw(400, "You can't update actions for this card yet.");
      }

      let usercardUpload;
      let actionUpload;

      if (intent === "vote") {
        if (
          usercard.upvoted_actions.filter((a) => a.id === actionId).length > 0
        ) {
          return ctx.throw(400, "You have already voted this action.");
        }
        actionUpload = { votes: action.votes + 1 };
        usercardUpload = {
          upvoted_actions: [...usercard.upvoted_actions, actionId],
        };
      }

      if (intent === "remove_vote") {
        if (
          usercard.upvoted_actions.filter((a) => a.id === actionId).length === 0
        ) {
          return ctx.throw(400, "You have not voted this yet.");
        }
        actionUpload = { votes: action.votes - 1 };
        const newActions = usercard.upvoted_actions.filter(
          (a) => a.id !== actionId
        );
        usercardUpload = {
          upvoted_actions: newActions,
        };
      }

      if (intent === "report") {
        if (
          usercard.reported_actions.filter((a) => a.id === actionId).length > 0
        ) {
          return ctx.throw(400, "You have already reported this action.");
        }
        actionUpload = { votes: action.reports + 1 };
        usercardUpload = {
          reported_actions: [...usercard.reported_actions, actionId],
        };
      }

      if (intent === "remove_report") {
        if (
          usercard.reported_actions.filter((a) => a.id === actionId).length ===
          0
        ) {
          return ctx.throw(400, "You have not reported this yet.");
        }
        actionUpload = { votes: action.reports - 1 };
        const newActions = usercard.reported_actions.filter(
          (a) => a.id !== actionId
        );
        usercardUpload = {
          reported_actions: newActions,
        };
      }

      if (intent === "add") {
        usercardUpload = {
          community_actions_claimed: [
            ...usercard.community_actions_claimed,
            actionId,
          ],
        };
      }

      if (intent === "remove_add") {
        const newActions = usercard.community_actions_claimed.filter(
          (a) => a.id !== actionId
        );
        usercardUpload = {
          community_actions_claimed: newActions,
        };
      }

      if (intent === "complete") {
        usercardUpload = {
          community_actions_completed: [
            ...usercard.community_actions_completed,
            actionId,
          ],
        };
      }

      if (intent === "remove_complete") {
        const newActions = usercard.community_actions_completed.filter(
          (a) => a.id !== actionId
        );
        usercardUpload = {
          community_actions_completed: newActions,
        };
      }

      if (
        intent === "vote" ||
        intent === "remove_vote" ||
        intent === "report" ||
        intent === "remove_report"
      ) {
        await strapi.db.query("api::communityaction.communityaction").update({
          where: { id: actionId },
          data: actionUpload,
        });
      }

      const usercardData = await strapi.db
        .query("api::usercard.usercard")
        .update({
          where: { id: usercard.id },
          data: usercardUpload,
          populate: true,
        });

      return {
        data: usercardData.upvoted_actions,
        notification: "COMMUNITY_ACTION_UPDATED",
      };
    },
  })
);
