'use strict';

/**
 * usercard service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::usercard.usercard');
