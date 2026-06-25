'use strict';

const customerHistoryService = require('../services/blockchain-proof-customer-history.service');

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
    message: error.message || 'Customer blockchain proof history API failed.',
    errorCode: 'CUSTOMER_BLOCKCHAIN_PROOF_HISTORY_ERROR',
    data: null,
    meta: null,
    timestamp: new Date().toISOString()
  });
}

async function sourceDiscovery(req, res) {
  try {
    const data = await customerHistoryService.discoverCustomerSourceViews();

    return successResponse(
      res,
      'Customer source view discovery loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function sourceCount(req, res) {
  try {
    const data = await customerHistoryService.getCustomerSourceCount();

    return successResponse(
      res,
      'Customer source count loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function preview(req, res) {
  try {
    const data = await customerHistoryService.previewCustomerHistorySync({
      limit: req.query.limit
    });

    return successResponse(
      res,
      'Customer history sync preview loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function sync(req, res) {
  try {
    const data = await customerHistoryService.syncCustomerHistory({
      limit: req.query.limit,
      dryRun: req.query.dryRun,
      submittedBy: req.query.submittedBy
    });

    return successResponse(
      res,
      data.dryRun
        ? 'Customer history sync dry run completed successfully.'
        : 'Customer history sync completed successfully.',
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
