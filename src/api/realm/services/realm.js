'use strict';

/**
 * realm service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::realm.realm');
