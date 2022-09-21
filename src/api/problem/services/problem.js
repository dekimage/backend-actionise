'use strict';

/**
 * problem service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::problem.problem');
