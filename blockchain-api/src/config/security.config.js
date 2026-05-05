'use strict';

/**
 * STEP 28 — API Security Configuration
 */

const parseOrigins = (value) => {
  if (!value) return [];

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const securityConfig = {
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '1mb',

  cors: {
    allowedOrigins: parseOrigins(process.env.CORS_ALLOWED_ORIGINS),
    allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-request-id',
      'x-service-name'
    ],
    exposedHeaders: ['x-request-id'],
    credentials: true
  },

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100)
  },

  authRateLimit: {
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    maxRequests: Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || 10)
  },

  apiKey: {
    enabled: String(process.env.ENABLE_API_KEY_PROTECTION || 'true') === 'true',
    internalApiKey: process.env.INTERNAL_API_KEY || null
  },

  logging: {
    enableSuspiciousLogging:
      String(process.env.ENABLE_SUSPICIOUS_REQUEST_LOGGING || 'true') === 'true'
  }
};

module.exports = securityConfig;