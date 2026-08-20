'use strict';

const blockchainKycService = require('../services/blockchain-kyc.service');

function resolveStatusCode(error) {
  const statusCode = Number(error?.statusCode || error?.status || 500);
  return statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
}

async function createBlockchainKycWallet(req, res) {
  try {
    const data = await blockchainKycService.createBlockchainKycWallet(
      req.body,
      req.files
    );

    return res.status(201).json({
      success: true,
      message: data.message || 'KYC request processed successfully.',
      data
    });
  } catch (error) {
    const statusCode = resolveStatusCode(error);

    console.error('[BLOCKCHAIN_KYC_CREATE_ERROR]', {
      message: error.message,
      originalMessage: error.originalError?.message,
      code: error.code || error.originalError?.code,
      detail: error.detail || error.originalError?.detail,
      table: error.table || error.originalError?.table,
      column: error.column || error.originalError?.column,
      constraint: error.constraint || error.originalError?.constraint,
      storageMode: error.storageMode || req.body?.storageMode || null,
      kycRequestId: error.kycRequest?.request_id
    });

    return res.status(statusCode).json({
      success: false,
      message:
        statusCode < 500
          ? error.message
          : 'Failed to process the KYC storage request.',
      error: {
        message: error.message,
        originalMessage: error.originalError?.message,
        code: error.code || error.originalError?.code,
        detail: error.detail || error.originalError?.detail,
        table: error.table || error.originalError?.table,
        column: error.column || error.originalError?.column,
        constraint: error.constraint || error.originalError?.constraint
      },
      data: {
        storageMode: error.storageMode || req.body?.storageMode || null,
        kycRequest: error.kycRequest || null,
        walletCreationStatus: 'FAILED'
      }
    });
  }
}

module.exports = {
  createBlockchainKycWallet
};
