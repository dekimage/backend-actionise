'use strict';

/**
 * expansion service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::expansion.expansion');
