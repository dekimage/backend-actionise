'use strict';

/**
 * idea service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::idea.idea');
