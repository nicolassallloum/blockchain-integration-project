'use strict';

/**
 * STEP 28 — Rate Limiting Middleware
 */

const rateLimit = require('express-rate-limit');
const securityConfig = require('../config/security.config');

const standardRateLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs,
  max: securityConfig.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: (req) => ({
    success: false,
    message: 'Too many requests. Please try again later.',
    errorCode: 'RATE_LIMIT_EXCEEDED',
    requestId: req.headers['x-request-id'] || null
  })
});

const authRateLimiter = rateLimit({
  windowMs: securityConfig.authRateLimit.windowMs,
  max: securityConfig.authRateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: (req) => ({
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
    errorCode: 'AUTH_RATE_LIMIT_EXCEEDED',
    requestId: req.headers['x-request-id'] || null
  })
});

module.exports = {
  standardRateLimiter,
  authRateLimiter
};