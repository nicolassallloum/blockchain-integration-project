'use strict';

const genericVerificationService = require('../services/blockchain-proof-generic-verification.service');

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
    message: error.message || 'Generic blockchain verification API failed.',
    errorCode: 'GENERIC_BLOCKCHAIN_VERIFICATION_ERROR',
    data: null,
    meta: null,
    timestamp: new Date().toISOString()
  });
}

function getRequestUser(req) {
  return (
    req.user?.username ||
    req.user?.email ||
    req.user?.user_id ||
    req.body?.verifiedBy ||
    req.query?.verifiedBy ||
    'generic-verification-api'
  );
}

async function verifyByModuleAndSourceRecordId(req, res) {
  try {
    const data = await genericVerificationService.verifyByModuleAndSourceRecordId({
      moduleName:
        req.body?.moduleName ||
        req.body?.module ||
        req.query?.moduleName ||
        req.query?.module,
      sourceRecordId:
        req.body?.sourceRecordId ||
        req.body?.source_record_id ||
        req.query?.sourceRecordId ||
        req.query?.source_record_id,
      verifiedBy: getRequestUser(req)
    });

    return successResponse(
      res,
      'Blockchain verification by module and source record ID completed successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error, 400);
  }
}

async function verifyByBlockchainKey(req, res) {
  try {
    const data = await genericVerificationService.verifyByBlockchainKey({
      blockchainKey:
        req.body?.blockchainKey ||
        req.body?.blockchain_key ||
        req.query?.blockchainKey ||
        req.query?.blockchain_key,
      verifiedBy: getRequestUser(req)
    });

    return successResponse(
      res,
      'Blockchain verification by blockchain key completed successfully.',
      data
    );
  } catch (error) {
    return errorResponse(res, error, 400);
  }
}

module.exports = {
  verifyByModuleAndSourceRecordId,
  verifyByBlockchainKey
};
