'use strict';

const amlHistoryService = require('../services/blockchain-proof-aml-history.service');

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
    message: error.message || 'AML blockchain proof history API failed.',
    errorCode: 'AML_BLOCKCHAIN_PROOF_HISTORY_ERROR',
    data: null,
    meta: null,
    timestamp: new Date().toISOString()
  });
}

async function sourceCount(req, res) {
  try {
    const data = await amlHistoryService.getAmlSourceCount();

    return successResponse(
      res,
      'AML source count loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function preview(req, res) {
  try {
    const data = await amlHistoryService.previewAmlHistorySync({
      limit: req.query.limit
    });

    return successResponse(
      res,
      'AML history sync preview loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function sync(req, res) {
  try {
    const data = await amlHistoryService.syncAmlHistory({
      limit: req.query.limit,
      dryRun: req.query.dryRun,
      submittedBy: req.query.submittedBy
    });

    return successResponse(
      res,
      data.dryRun
        ? 'AML history sync dry run completed successfully.'
        : 'AML history sync completed successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

module.exports = {
  sourceCount,
  preview,
  sync
};
