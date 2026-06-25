'use strict';

const transactionHistoryService = require('../services/blockchain-proof-transaction-history.service');

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
    message: error.message || 'Transaction blockchain proof history API failed.',
    errorCode: 'TRANSACTION_BLOCKCHAIN_PROOF_HISTORY_ERROR',
    data: null,
    meta: null,
    timestamp: new Date().toISOString()
  });
}

async function sourceDiscovery(req, res) {
  try {
    const data = await transactionHistoryService.discoverTransactionSourceViews();

    return successResponse(
      res,
      'Transaction source view discovery loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function sourceCount(req, res) {
  try {
    const data = await transactionHistoryService.getTransactionSourceCount();

    return successResponse(
      res,
      'Transaction source count loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function preview(req, res) {
  try {
    const data = await transactionHistoryService.previewTransactionHistorySync({
      limit: req.query.limit
    });

    return successResponse(
      res,
      'Transaction history sync preview loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function sync(req, res) {
  try {
    const data = await transactionHistoryService.syncTransactionHistory({
      limit: req.query.limit,
      dryRun: req.query.dryRun,
      submittedBy: req.query.submittedBy
    });

    return successResponse(
      res,
      data.dryRun
        ? 'Transaction history sync dry run completed successfully.'
        : 'Transaction history sync completed successfully.',
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
