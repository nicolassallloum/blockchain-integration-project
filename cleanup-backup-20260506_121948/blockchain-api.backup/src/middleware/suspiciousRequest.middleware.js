'use strict';

/**
 * STEP 28 — Suspicious Request Logging Middleware
 */

const crypto = require('crypto');
const securityConfig = require('../config/security.config');

const suspiciousPatterns = [
  /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bALTER\b|\bTRUNCATE\b)/i,
  /('|")\s*OR\s*('|")?\d+('|")?\s*=\s*('|")?\d+/i,
  /--|\/\*|\*\//,
  /<script\b[^>]*>/i,
  /javascript:/i,
  /\.\.\//,
  /etc\/passwd/i,
  /cmd\.exe/i,
  /powershell/i,
  /wget\s+/i,
  /curl\s+/i
];

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function containsSuspiciousContent(value) {
  if (value === null || value === undefined) return false;

  const text =
    typeof value === 'string'
      ? value
      : safeStringify(value);

  return suspiciousPatterns.some((pattern) => pattern.test(text));
}

function maskSensitiveHeaders(headers = {}) {
  const masked = { ...headers };

  const sensitiveHeaderNames = [
    'authorization',
    'x-api-key',
    'cookie',
    'set-cookie'
  ];

  sensitiveHeaderNames.forEach((headerName) => {
    if (masked[headerName]) {
      masked[headerName] = '[MASKED]';
    }
  });

  return masked;
}

function suspiciousRequestLogger(req, res, next) {
  if (!securityConfig.logging.enableSuspiciousLogging) {
    return next();
  }

  const checks = {
    url: req.originalUrl,
    query: req.query,
    body: req.body,
    params: req.params,
    userAgent: req.headers['user-agent']
  };

  const detectedFields = Object.entries(checks)
    .filter(([, value]) => containsSuspiciousContent(value))
    .map(([key]) => key);

  if (detectedFields.length > 0) {
    const incidentId = crypto.randomBytes(8).toString('hex');

    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'SUSPICIOUS_REQUEST_DETECTED',
        incidentId,
        requestId: req.headers['x-request-id'] || null,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        detectedFields,
        headers: maskSensitiveHeaders(req.headers),
        timestamp: new Date().toISOString()
      })
    );
  }

  return next();
}

module.exports = suspiciousRequestLogger;