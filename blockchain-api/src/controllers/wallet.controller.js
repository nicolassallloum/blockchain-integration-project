'use strict';

const walletService = require('../services/wallet.service');

function getRequestId(req) {
  return req.requestId || req.headers['x-request-id'] || null;
}

function getCorrelationId(req) {
  return req.headers['x-correlation-id'] || getRequestId(req);
}

function buildRequestContext(req) {
  return {
    requestId: getRequestId(req),
    request_id: getRequestId(req),
    correlationId: getCorrelationId(req),
    correlation_id: getCorrelationId(req),
    sourceSystem:
      req.headers['x-source-system'] ||
      req.body?.sourceSystem ||
      req.body?.source_system ||
      'BLOCKCHAIN_API',
    source_system:
      req.headers['x-source-system'] ||
      req.body?.sourceSystem ||
      req.body?.source_system ||
      'BLOCKCHAIN_API',
    requestSource:
      req.headers['x-request-source'] ||
      req.body?.requestSource ||
      req.body?.request_source ||
      'API',
    request_source:
      req.headers['x-request-source'] ||
      req.body?.requestSource ||
      req.body?.request_source ||
      'API',
    createdBy:
      req.body?.createdBy ||
      req.body?.created_by ||
      req.headers['x-created-by'] ||
      'api-user',
    created_by:
      req.body?.createdBy ||
      req.body?.created_by ||
      req.headers['x-created-by'] ||
      'api-user'
  };
}

function getErrorStatusCode(error, defaultStatus = 400) {
  const message = String(error.message || '').toLowerCase();

  if (
    message.includes('blockchain wallet creation failed') ||
    message.includes('fabric') ||
    message.includes('endorsement') ||
    message.includes('deadline') ||
    message.includes('gateway') ||
    message.includes('grpc')
  ) {
    return 502;
  }

  if (message.includes('already exists')) {
    return 409;
  }

  if (message.includes('not found')) {
    return 404;
  }

  return defaultStatus;
}

exports.getNextCustomerId = async (req, res, next) => {
  try {
    const result = await walletService.getNextCustomerId();

    return res.status(200).json({
      success: true,
      message: 'Next customer ID generated successfully',
      data: {
        customerId: result.customerId,
        customer_id: result.customerId
      },
      requestId: getRequestId(req)
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/v1/wallets?page=1&limit=13&search=
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
    const result = await walletService.createWallet({
      ...req.body,
      ...buildRequestContext(req)
    });

    return res.status(201).json({
      success: true,
      message: 'Wallet created successfully in Blockchain and PostgreSQL',
      data: result,
      source: 'fabric_postgres',
      requestId: getRequestId(req)
    });
  } catch (error) {
    const statusCode = getErrorStatusCode(error, 400);

    return res.status(statusCode).json({
      success: false,
      message: 'Failed to create wallet',
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      },
      source: statusCode === 502 ? 'fabric' : 'api',
      requestId: getRequestId(req)
    });
  }
};

/**
 * POST /api/v1/wallets/organization-wallets
 */
exports.createOrganizationWallet = async (req, res) => {
  try {
    const result = await walletService.createOrganizationWallet({
      ...req.body,
      ...buildRequestContext(req)
    });

    return res.status(201).json({
      success: true,
      message: 'Organization wallet created successfully in Blockchain and PostgreSQL',
      data: result,
      source: 'fabric_postgres',
      requestId: getRequestId(req)
    });
  } catch (error) {
    const statusCode = getErrorStatusCode(error, 400);

    return res.status(statusCode).json({
      success: false,
      message: 'Failed to create organization wallet',
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      },
      source: statusCode === 502 ? 'fabric' : 'api',
      requestId: getRequestId(req)
    });
  }
};

/**
 * POST /api/v1/wallets/login
 */
exports.loginWallet = async (req, res, next) => {
  try {
    const walletAddress =
      req.body.walletAddress ||
      req.body.wallet_address ||
      req.body.loginId ||
      req.body.customerId;

    const password = req.body.password;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'walletAddress is required',
        error: {
          message: 'walletAddress is required'
        },
        requestId: getRequestId(req)
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'password is required',
        error: {
          message: 'password is required'
        },
        requestId: getRequestId(req)
      });
    }

    const result = await walletService.loginWallet({
      walletAddress,
      password
    });

    if (!result) {
      return res.status(401).json({
        success: false,
        message: 'Wallet login failed',
        error: {
          message: 'Invalid wallet address or password'
        },
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
    return next(error);
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