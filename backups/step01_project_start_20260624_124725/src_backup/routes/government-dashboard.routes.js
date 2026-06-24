const express = require('express');
const router = express.Router();
const dashboardService = require('../services/government-dashboard.service');

function success(res, data) {
  return res.json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  });
}

function failure(res, error) {
  console.error('[GOVERNMENT DASHBOARD ERROR]', error);
  return res.status(500).json({
    success: false,
    message: error.message || 'Dashboard request failed',
    data: null,
    timestamp: new Date().toISOString()
  });
}

router.get('/summary', async (req, res) => {
  try {
    const data = await dashboardService.getSummary();
    return success(res, data);
  } catch (error) {
    return failure(res, error);
  }
});

router.get('/charts', async (req, res) => {
  try {
    const data = await dashboardService.getCharts();
    return success(res, data);
  } catch (error) {
    return failure(res, error);
  }
});

router.get('/health', async (req, res) => {
  try {
    const data = await dashboardService.getHealth();
    return success(res, data);
  } catch (error) {
    return failure(res, error);
  }
});

router.get('/recent-transactions', async (req, res) => {
  try {
    const data = await dashboardService.getRecentTransactions();
    return success(res, data);
  } catch (error) {
    return failure(res, error);
  }
});

module.exports = router;
