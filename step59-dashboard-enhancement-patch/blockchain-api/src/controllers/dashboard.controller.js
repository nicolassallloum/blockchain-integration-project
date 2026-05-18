'use strict';

const dashboardService = require('../services/dashboard.service');

async function getDashboardSummary(req, res, next) {
  try {
    const data = await dashboardService.getDashboardSummary();

    return res.status(200).json({
      success: true,
      message: 'Dashboard summary loaded successfully.',
      data,
      meta: {
        source: 'postgres',
        schema: 'blockchain',
        generatedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId || null,
      correlationId: req.correlationId || req.requestId || null
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getDashboardSummary
};
