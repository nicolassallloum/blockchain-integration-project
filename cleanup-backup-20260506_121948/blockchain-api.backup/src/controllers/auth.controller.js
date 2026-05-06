'use strict';

/**
 * STEP 27 — Authentication Controller
 */

const bcrypt = require('bcryptjs');
const authConfig = require('../config/auth.config');
const {
  generateUserToken,
  generateSystemToken
} = require('../utils/token.util');

/**
 * Demo user login.
 *
 * In production:
 * - Validate against PostgreSQL auth table.
 * - Compare password using bcrypt.
 * - Load roles from DB.
 * - Load permissions from DB.
 */
async function loginUser(req, res, next) {
  try {
    const {
      customerId,
      walletAddress,
      password
    } = req.body;

    if ((!customerId && !walletAddress) || !password) {
      return res.status(400).json({
        success: false,
        message: 'customerId or walletAddress and password are required',
        errorCode: 'VALIDATION_ERROR',
        requestId: req.headers['x-request-id'] || null
      });
    }

    /**
     * TEMPORARY DEV AUTH LOGIC
     *
     * Replace this with PostgreSQL lookup:
     * SELECT customer_id, wallet_address, password_hash, organization_id, roles
     * FROM blockchain.wallets / auth table
     * WHERE customer_id = $1 OR wallet_address = $2
     */
    const demoPasswordHash = await bcrypt.hash('password123', 10);
    const passwordValid = await bcrypt.compare(password, demoPasswordHash);

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials',
        errorCode: 'INVALID_CREDENTIALS',
        data: null,
        requestId: req.headers['x-request-id'] || null
      });
    }

    const token = generateUserToken({
      userId: customerId || walletAddress,
      customerId: customerId || null,
      walletAddress: walletAddress || null,
      organizationId: null,
      roles: [authConfig.roles.CUSTOMER],
      permissions: [
        'wallet:read',
        'transaction:create',
        'transaction:read'
      ]
    });

    return res.status(200).json({
      success: true,
      message: 'User login successful',
      data: {
        tokenType: 'Bearer',
        accessToken: token,
        expiresIn: authConfig.jwt.expiresIn
      },
      requestId: req.headers['x-request-id'] || null
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Generate system token for internal services.
 *
 * Protected by API key.
 */
async function issueSystemToken(req, res, next) {
  try {
    const {
      serviceName,
      serviceId
    } = req.body;

    if (!serviceName) {
      return res.status(400).json({
        success: false,
        message: 'serviceName is required',
        errorCode: 'VALIDATION_ERROR',
        requestId: req.headers['x-request-id'] || null
      });
    }

    const token = generateSystemToken({
      serviceName,
      serviceId: serviceId || serviceName,
      roles: [authConfig.roles.SYSTEM],
      permissions: [
        'wallet:create',
        'wallet:read',
        'transaction:create',
        'transaction:read',
        'fabric:submit',
        'fabric:evaluate'
      ]
    });

    return res.status(200).json({
      success: true,
      message: 'System token issued successfully',
      data: {
        tokenType: 'Bearer',
        accessToken: token,
        expiresIn: authConfig.systemJwt.expiresIn
      },
      requestId: req.headers['x-request-id'] || null
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Return authenticated principal.
 */
async function me(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      message: 'Authenticated principal retrieved successfully',
      data: {
        auth: req.auth || null,
        apiKeyAuth: req.apiKeyAuth || null
      },
      requestId: req.headers['x-request-id'] || null
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  loginUser,
  issueSystemToken,
  me
};
