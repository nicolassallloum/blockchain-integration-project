'use strict';

const screeningHistoryService = require('../services/blockchain-proof-screening-history.service');

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
    message: error.message || 'Screening blockchain proof history API failed.',
    errorCode: 'SCREENING_BLOCKCHAIN_PROOF_HISTORY_ERROR',
    data: null,
    meta: null,
    timestamp: new Date().toISOString()
  });
}

async function sourceDiscovery(req, res) {
  try {
    const data = await screeningHistoryService.discoverScreeningSourceViews();

    return successResponse(
      res,
      'Screening source view discovery loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function sourceCount(req, res) {
  try {
    const data = await screeningHistoryService.getScreeningSourceCount();

    return successResponse(
      res,
      'Screening source count loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function preview(req, res) {
  try {
    const data = await screeningHistoryService.previewScreeningHistorySync({
      limit: req.query.limit
    });

    return successResponse(
      res,
      'Screening history sync preview loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function sync(req, res) {
  try {
    const data = await screeningHistoryService.syncScreeningHistory({
      limit: req.query.limit,
      dryRun: req.query.dryRun,
      submittedBy: req.query.submittedBy
    });

    return successResponse(
      res,
      data.dryRun
        ? 'Screening history sync dry run completed successfully.'
        : 'Screening history sync completed successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

module.exports = {
  sourceDiscovery,
  sourceCount,
  preview,
  sync
};
