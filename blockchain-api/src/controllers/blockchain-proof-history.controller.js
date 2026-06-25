'use strict';

const historyService = require('../services/blockchain-proof-history.service');

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
    message: error.message || 'Blockchain proof history API failed.',
    errorCode: 'BLOCKCHAIN_PROOF_HISTORY_ERROR',
    data: null,
    meta: null,
    timestamp: new Date().toISOString()
  });
}

async function health(req, res) {
  try {
    const data = await historyService.getHealth();

    return successResponse(
      res,
      'Blockchain proof history API is healthy.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function listHistory(req, res) {
  try {
    const result = await historyService.listHistory({
      recordType: req.query.recordType,
      sourceRecordId: req.query.sourceRecordId,
      actionType: req.query.actionType,
      syncStatus: req.query.syncStatus,
      limit: req.query.limit,
      offset: req.query.offset
    });

    return successResponse(
      res,
      'Blockchain proof history loaded successfully.',
      result.rows,
      result.meta
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function listRecordHistory(req, res) {
  try {
    const result = await historyService.listHistory({
      recordType: req.params.recordType,
      sourceRecordId: req.query.sourceRecordId,
      actionType: req.query.actionType,
      syncStatus: req.query.syncStatus,
      limit: req.query.limit,
      offset: req.query.offset
    });

    return successResponse(
      res,
      'Blockchain proof record history loaded successfully.',
      result.rows,
      result.meta
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getHistoryById(req, res) {
  try {
    const result = await historyService.getHistoryById(req.params.historyId);

    if (!result.row) {
      return res.status(404).json({
        success: false,
        message: 'Blockchain proof history row not found.',
        errorCode: 'BLOCKCHAIN_PROOF_HISTORY_NOT_FOUND',
        data: null,
        meta: result.meta,
        timestamp: new Date().toISOString()
      });
    }

    return successResponse(
      res,
      'Blockchain proof history row loaded successfully.',
      result.row,
      result.meta
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getLatestRecordHistory(req, res) {
  try {
    const result = await historyService.getLatestHistoryForSource(
      req.params.recordType,
      req.query.sourceRecordId
    );

    return successResponse(
      res,
      'Latest blockchain proof history row loaded successfully.',
      result.row,
      result.meta
    );
  } catch (error) {
    return errorResponse(res, error, error.message.includes('required') ? 400 : 500);
  }
}

async function summary(req, res) {
  try {
    const result = await historyService.getHistorySummary();

    return successResponse(
      res,
      'Blockchain proof history summary loaded successfully.',
      result.rows,
      result.meta
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

module.exports = {
  health,
  listHistory,
  listRecordHistory,
  getHistoryById,
  getLatestRecordHistory,
  summary
};
