'use strict';

const organizationService = require('../services/organization.service');

async function getOrganizations(req, res, next) {
  try {
    const result = await organizationService.getOrganizations(req.query || {});

    return res.status(200).json({
      ...result,
      requestId: req.requestId,
      correlationId: req.correlationId || req.requestId
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getOrganizations
};