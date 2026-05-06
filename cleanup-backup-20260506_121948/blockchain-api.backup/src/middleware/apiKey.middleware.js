'use strict';

/**
 * STEP 28 — API Key Protection Middleware
 *
 * Used for internal service-to-service endpoints.
 */

const crypto = require('crypto');
const securityConfig = require('../config/security.config');

function safeCompare(valueA, valueB) {
  if (!valueA || !valueB) return false;

  const bufferA = Buffer.from(valueA);
  const bufferB = Buffer.from(valueB);

  if (bufferA.length !== bufferB.length) return false;

  return crypto.timingSafeEqual(bufferA, bufferB);
}

function apiKeyProtection(req, res, next) {
  if (!securityConfig.apiKey.enabled) {
    return next();
  }

  const configuredApiKey = securityConfig.apiKey.internalApiKey;
  const providedApiKey = req.headers['x-api-key'];

  if (!configuredApiKey) {
    return res.status(500).json({
      success: false,
      message: 'API key protection is enabled but INTERNAL_API_KEY is not configured',
      errorCode: 'API_KEY_NOT_CONFIGURED',
      requestId: req.headers['x-request-id'] || null
    });
  }

  if (!providedApiKey || !safeCompare(providedApiKey, configuredApiKey)) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'INVALID_OR_MISSING_API_KEY',
        requestId: req.headers['x-request-id'] || null,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        timestamp: new Date().toISOString()
      })
    );

    return res.status(401).json({
      success: false,
      message: 'Unauthorized service request',
      errorCode: 'INVALID_API_KEY',
      requestId: req.headers['x-request-id'] || null
    });
  }

  return next();
}

module.exports = apiKeyProtection;