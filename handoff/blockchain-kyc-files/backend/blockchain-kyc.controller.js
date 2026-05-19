'use strict';

const blockchainKycService = require('../services/blockchain-kyc.service');

async function createBlockchainKycWallet(req, res, next) {
  try {
    const data = await blockchainKycService.createBlockchainKycWallet(
      req.body,
      req.files
    );

    return res.status(201).json({
      success: true,
      message: 'Blockchain KYC wallet request created successfully.',
      data
    });
  } catch (error) {
    console.error('[BLOCKCHAIN_KYC_CREATE_ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      table: error.table,
      column: error.column,
      constraint: error.constraint
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to create Blockchain KYC wallet request',
      error: {
        message: error.message,
        code: error.code,
        detail: error.detail,
        table: error.table,
        column: error.column,
        constraint: error.constraint
      },
      data: null
    });
  }
}

module.exports = {
  createBlockchainKycWallet
};