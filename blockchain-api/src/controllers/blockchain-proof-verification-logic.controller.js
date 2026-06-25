'use strict';

const verificationLogicService = require('../services/blockchain-proof-verification-logic.service');

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
    message: error.message || 'Blockchain proof verification logic API failed.',
    errorCode: 'BLOCKCHAIN_PROOF_VERIFICATION_LOGIC_ERROR',
    data: null,
    meta: null,
    timestamp: new Date().toISOString()
  });
}

async function health(req, res) {
  try {
    const data = await verificationLogicService.getVerificationHealth();

    return successResponse(
      res,
      'Blockchain proof verification logic health loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function candidates(req, res) {
  try {
    const data = await verificationLogicService.getVerificationCandidates({
      recordType: req.query.recordType,
      sourceRecordId: req.query.sourceRecordId,
      limit: req.query.limit
    });

    return successResponse(
      res,
      'Blockchain proof verification candidates loaded successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function run(req, res) {
  try {
    const data = await verificationLogicService.runVerification({
      recordType: req.query.recordType,
      sourceRecordId: req.query.sourceRecordId,
      limit: req.query.limit,
      dryRun: req.query.dryRun,
      verifiedBy: req.query.verifiedBy
    });

    return successResponse(
      res,
      data.dryRun
        ? 'Blockchain proof verification dry run completed successfully.'
        : 'Blockchain proof verification run completed successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function runRecord(req, res) {
  try {
    const data = await verificationLogicService.runVerification({
      recordType: req.params.recordType,
      sourceRecordId: req.query.sourceRecordId,
      limit: req.query.limit || 1,
      dryRun: req.query.dryRun,
      verifiedBy: req.query.verifiedBy
    });

    return successResponse(
      res,
      data.dryRun
        ? 'Blockchain proof record verification dry run completed successfully.'
        : 'Blockchain proof record verification run completed successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error);
  }
}

module.exports = {
  health,
  candidates,
  run,
  runRecord
};
