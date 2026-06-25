'use strict';

const verificationService = require('../services/blockchain-proof-verification.service');

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
    message: error.message || 'Blockchain proof verification API failed.',
    errorCode: 'BLOCKCHAIN_PROOF_VERIFICATION_ERROR',
    data: null,
    meta: null,
    timestamp: new Date().toISOString()
  });
}

async function health(req, res) {
  try {
    const data = await verificationService.getHealth();

    return successResponse(
      res,
      'Blockchain proof verification API is healthy.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function listLogs(req, res) {
  try {
    const result = await verificationService.listVerificationLogs({
      recordType: req.query.recordType,
      sourceRecordId: req.query.sourceRecordId,
      verificationStatus: req.query.verificationStatus,
      limit: req.query.limit,
      offset: req.query.offset
    });

    return successResponse(
      res,
      'Blockchain proof verification logs loaded successfully.',
      result.rows,
      result.meta
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function listRecordLogs(req, res) {
  try {
    const result = await verificationService.listVerificationLogs({
      recordType: req.params.recordType,
      sourceRecordId: req.query.sourceRecordId,
      verificationStatus: req.query.verificationStatus,
      limit: req.query.limit,
      offset: req.query.offset
    });

    return successResponse(
      res,
      'Blockchain proof record verification logs loaded successfully.',
      result.rows,
      result.meta
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getLogById(req, res) {
  try {
    const result = await verificationService.getVerificationLogById(
      req.params.verificationId
    );

    if (!result.row) {
      return res.status(404).json({
        success: false,
        message: 'Blockchain proof verification log not found.',
        errorCode: 'BLOCKCHAIN_PROOF_VERIFICATION_NOT_FOUND',
        data: null,
        meta: result.meta,
        timestamp: new Date().toISOString()
      });
    }

    return successResponse(
      res,
      'Blockchain proof verification log loaded successfully.',
      result.row,
      result.meta
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function getLatestRecordLog(req, res) {
  try {
    const result = await verificationService.getLatestVerificationLog(
      req.params.recordType,
      req.query.sourceRecordId
    );

    return successResponse(
      res,
      'Latest blockchain proof verification log loaded successfully.',
      result.row,
      result.meta
    );
  } catch (error) {
    return errorResponse(res, error, error.message.includes('required') ? 400 : 500);
  }
}

async function summary(req, res) {
  try {
    const result = await verificationService.getVerificationSummary();

    return successResponse(
      res,
      'Blockchain proof verification summary loaded successfully.',
      result.rows,
      result.meta
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function preview(req, res) {
  try {
    const data = await verificationService.previewVerification(
      req.params.recordType,
      req.query
    );

    return successResponse(
      res,
      'Blockchain proof verification preview loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error, error.message.includes('required') ? 400 : 500);
  }
}

module.exports = {
  health,
  listLogs,
  listRecordLogs,
  getLogById,
  getLatestRecordLog,
  summary,
  preview
};
