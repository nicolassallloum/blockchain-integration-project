'use strict';

const retryService = require('../services/blockchain-proof-retry.service');

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
    message: error.message || 'Blockchain proof retry API failed.',
    errorCode: 'BLOCKCHAIN_PROOF_RETRY_ERROR',
    data: null,
    meta: null,
    timestamp: new Date().toISOString()
  });
}

async function health(req, res) {
  try {
    const data = await retryService.getRetryHealth();

    return successResponse(
      res,
      'Blockchain proof retry service health loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function candidates(req, res) {
  try {
    const data = await retryService.getRetryCandidates({
      recordType: req.query.recordType,
      limit: req.query.limit,
      maxRetries: req.query.maxRetries
    });

    return successResponse(
      res,
      'Blockchain proof retry candidates loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function run(req, res) {
  try {
    const data = await retryService.runRetry({
      recordType: req.query.recordType,
      limit: req.query.limit,
      maxRetries: req.query.maxRetries,
      dryRun: req.query.dryRun,
      submittedBy: req.query.submittedBy
    });

    return successResponse(
      res,
      data.dryRun
        ? 'Blockchain proof retry dry run completed successfully.'
        : 'Blockchain proof retry run completed successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

module.exports = {
  health,
  candidates,
  run
};
