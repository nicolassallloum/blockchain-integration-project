'use strict';

/**
 * STEP 27 — API Key Validation Middleware
 */

const crypto = require('crypto');
const authConfig = require('../config/auth.config');
const { AuthError } = require('../utils/authErrors');

function safeCompare(a, b) {
  const valueA = Buffer.from(String(a || ''), 'utf8');
  const valueB = Buffer.from(String(b || ''), 'utf8');

  if (valueA.length !== valueB.length) {
    return false;
  }

  return crypto.timingSafeEqual(valueA, valueB);
}

function validateApiKey(req, res, next) {
  try {
    if (!authConfig.authEnabled) {
      return next();
    }

    const headerName = authConfig.apiKey.headerName.toLowerCase();
    const providedApiKey = req.headers[headerName];
    const expectedApiKey = authConfig.apiKey.internalServiceApiKey;

    if (!providedApiKey) {
      throw new AuthError(`Missing API key header: ${headerName}`, 401, 'API_KEY_MISSING');
    }

    if (!expectedApiKey || expectedApiKey.includes('change-me')) {
      throw new AuthError('Internal API key is not configured securely', 500, 'API_KEY_NOT_CONFIGURED');
    }

    if (!safeCompare(providedApiKey, expectedApiKey)) {
      throw new AuthError('Invalid API key', 401, 'INVALID_API_KEY');
    }

    req.apiKeyAuth = {
      authenticated: true,
      headerName
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  validateApiKey
};