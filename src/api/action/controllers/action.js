"use strict";

/**
 *  action controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::action.action", ({ strapi }) => ({
  async complete(ctx) {
    const params = ctx.params.id;
    const { item } = ctx.request.body;

    console.log("params", params);
    console.log("item", item);

    try {
      ctx.body = "ok";
    } catch (err) {
      ctx.body = err;
    }
  },
}));
