'use strict';

/**
 * webpage service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::webpage.webpage');
