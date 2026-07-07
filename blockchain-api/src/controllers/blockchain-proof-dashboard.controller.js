'use strict';

const dashboardService = require('../services/blockchain-proof-dashboard.service');

function successResponse(res, message, data, meta = null) {
  return res.json({
    success: true,
    message,
    data,
    meta,
    timestamp: new Date().toISOString()
  });
}

function errorResponse(res, error, statusCode = 500) {
  return res.status(statusCode).json({
    success: false,
    message: error.message || 'Blockchain proof dashboard API failed.',
    errorCode: 'BLOCKCHAIN_PROOF_DASHBOARD_ERROR',
    data: null,
    meta: null,
    timestamp: new Date().toISOString()
  });
}

async function health(req, res) {
  try {
    const data = await dashboardService.getDashboardHealth();

    return successResponse(
      res,
      'Blockchain proof dashboard health loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function summary(req, res) {
  try {
    const data = await dashboardService.getDashboardSummary();

    return successResponse(
      res,
      'Blockchain proof dashboard summary loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function recordTypes(req, res) {
  try {
    const data = await dashboardService.getRecordTypeBreakdown();

    return successResponse(
      res,
      'Blockchain proof dashboard record type breakdown loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function syncStatus(req, res) {
  try {
    const data = await dashboardService.getSyncStatusBreakdown();

    return successResponse(
      res,
      'Blockchain proof dashboard sync status breakdown loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function verificationStatus(req, res) {
  try {
    const data = await dashboardService.getVerificationStatusBreakdown();

    return successResponse(
      res,
      'Blockchain proof dashboard verification status breakdown loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function retrySummary(req, res) {
  try {
    const data = await dashboardService.getRetrySummary();

    return successResponse(
      res,
      'Blockchain proof dashboard retry summary loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function latestRuns(req, res) {
  try {
    const data = await dashboardService.getLatestRuns({
      limit: req.query.limit,
      recordType: req.query.recordType
    });

    return successResponse(
      res,
      'Blockchain proof dashboard latest runs loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function latestHistory(req, res) {
  try {
    const data = await dashboardService.getLatestHistory({
      limit: req.query.limit,
      recordType: req.query.recordType
    });

    return successResponse(
      res,
      'Blockchain proof dashboard latest history loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function latestVerificationLogs(req, res) {
  try {
    const data = await dashboardService.getLatestVerificationLogs({
      limit: req.query.limit,
      recordType: req.query.recordType
    });

    return successResponse(
      res,
      'Blockchain proof dashboard latest verification logs loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function auditMetrics(req, res) {
  try {
    const data = await dashboardService.getAuditDashboardMetrics({
      limit: req.query.limit,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      moduleName: req.query.moduleName,
      module: req.query.module,
      recordType: req.query.recordType,
      status: req.query.status,
      verificationStatus: req.query.verificationStatus,
      blockchainStatus: req.query.blockchainStatus
    });

    return successResponse(
      res,
      'Blockchain proof audit dashboard metrics loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function full(req, res) {
  try {
    const data = await dashboardService.getDashboardFull({
      limit: req.query.limit
    });

    return successResponse(
      res,
      'Blockchain proof dashboard full data loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

module.exports = {
  health,
  summary,
  recordTypes,
  syncStatus,
  verificationStatus,
  retrySummary,
  latestRuns,
  latestHistory,
  latestVerificationLogs,
  auditMetrics,
  full
};
