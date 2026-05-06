'use strict';

const walletService = require('../services/wallet.service');

function getRequestId(req) {
  return req.requestId || req.headers['x-request-id'] || null;
}

/**
 * GET /api/v1/wallets?page=1&limit=13&search=
 * Reads wallets from PostgreSQL table blockchain.wallets
 */
exports.listWallets = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '13', 10), 1), 100);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    const result = await walletService.listWallets({
      page,
      limit,
      offset,
      search
    });

    return res.status(200).json({
      success: true,
      message: 'Wallet list retrieved successfully',
      data: result.data,
      pagination: {
        page,
        limit,
        totalRecords: result.totalRecords,
        totalPages: Math.ceil(result.totalRecords / limit),
        hasNextPage: page < Math.ceil(result.totalRecords / limit),
        hasPreviousPage: page > 1
      },
      filters: {
        search: search || null
      },
      source: 'postgres',
      requestId: getRequestId(req)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve wallet list',
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      },
      requestId: getRequestId(req)
    });
  }
};

/**
 * POST /api/v1/wallets
 */
exports.createWallet = async (req, res) => {
  try {
    const result = await walletService.createWallet(req.body);

    return res.status(201).json({
      success: true,
      message: 'Wallet created successfully',
      data: result,
      requestId: getRequestId(req)
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to create wallet',
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      },
      requestId: getRequestId(req)
    });
  }
};

/**
 * POST /api/v1/wallets/login
 */
exports.loginWallet = async (req, res) => {
  try {
    const { customerId, password } = req.body;

    const result = await walletService.loginWallet({
      customerId,
      password
    });

    if (!result) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials',
        errorCode: 'INVALID_CREDENTIALS',
        data: null,
        requestId: getRequestId(req)
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Wallet login successful',
      data: result,
      requestId: getRequestId(req)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Wallet login failed',
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      },
      requestId: getRequestId(req)
    });
  }
};

/**
 * GET /api/v1/wallets/customer/:customerId
 */
exports.getWalletByCustomerId = async (req, res) => {
  try {
    const { customerId } = req.params;

    const wallet = await walletService.getWalletByCustomerId(customerId);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: `Wallet not found for customerId: ${customerId}`,
        data: null,
        requestId: getRequestId(req)
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Wallet retrieved successfully',
      data: {
        wallet
      },
      source: 'postgres',
      requestId: getRequestId(req)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve wallet by customer ID',
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      },
      requestId: getRequestId(req)
    });
  }
};

/**
 * GET /api/v1/wallets/:walletAddress
 */
exports.getWalletByAddress = async (req, res) => {
  try {
    const { walletAddress } = req.params;

    const wallet = await walletService.getWalletByAddress(walletAddress);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: `Wallet not found for walletAddress: ${walletAddress}`,
        data: null,
        requestId: getRequestId(req)
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Wallet retrieved successfully',
      data: {
        wallet
      },
      source: 'postgres',
      requestId: getRequestId(req)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve wallet by wallet address',
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      },
      requestId: getRequestId(req)
    });
  }
};
