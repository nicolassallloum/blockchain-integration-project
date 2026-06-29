'use strict';

const amlCaseClosureHistoryService = require('../services/blockchain-proof-aml-case-closure-history.service');

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
    message: error.message || 'AML case closure blockchain proof history API failed.',
    errorCode: 'AML_CASE_CLOSURE_BLOCKCHAIN_PROOF_HISTORY_ERROR',
    data: null,
    meta: null,
    timestamp: new Date().toISOString()
  });
}

async function sourceDiscovery(req, res) {
  try {
    const data = await amlCaseClosureHistoryService.discoverAmlCaseClosureSourceViews();

    return successResponse(
      res,
      'AML case closure source view discovery loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function sourceCount(req, res) {
  try {
    const data = await amlCaseClosureHistoryService.getAmlCaseClosureSourceCount();

    return successResponse(
      res,
      'AML case closure source count loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function preview(req, res) {
  try {
    const data = await amlCaseClosureHistoryService.previewAmlCaseClosureHistorySync({
      limit: req.query.limit
    });

    return successResponse(
      res,
      'AML case closure history sync preview loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function sync(req, res) {
  try {
    const data = await amlCaseClosureHistoryService.syncAmlCaseClosureHistory({
      limit: req.query.limit,
      dryRun: req.query.dryRun,
      submittedBy: req.query.submittedBy
    });

    return successResponse(
      res,
      data.dryRun
        ? 'AML case closure history sync dry run completed successfully.'
        : 'AML case closure history sync completed successfully.',
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
