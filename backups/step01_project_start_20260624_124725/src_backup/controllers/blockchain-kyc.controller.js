'use strict';

const blockchainKycService = require('../services/blockchain-kyc.service');

async function createBlockchainKycWallet(req, res) {
  try {
    const data = await blockchainKycService.createBlockchainKycWallet(
      req.body,
      req.files
    );

    return res.status(201).json({
      success: true,
      message: data.message || 'Blockchain KYC wallet created successfully.',
      data
    });
  } catch (error) {
    console.error('[BLOCKCHAIN_KYC_CREATE_ERROR]', {
      message: error.message,
      originalMessage: error.originalError?.message,
      code: error.code || error.originalError?.code,
      detail: error.detail || error.originalError?.detail,
      table: error.table || error.originalError?.table,
      column: error.column || error.originalError?.column,
      constraint: error.constraint || error.originalError?.constraint,
      kycRequestId: error.kycRequest?.request_id
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to create Blockchain KYC wallet in enterprise tables and Fabric ledger.',
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
        kycRequest: error.kycRequest || null,
        walletCreationStatus: 'FAILED'
      }
    });
  }
}

module.exports = {
  createBlockchainKycWallet
};
