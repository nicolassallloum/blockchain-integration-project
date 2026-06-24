'use strict';

/**
 * STEP 28 — SQL Injection Protection Middleware
 *
 * Important:
 * This middleware is a defensive layer only.
 * The main protection must remain parameterized SQL queries.
 */

const sqlInjectionPatterns = [
  /(\bUNION\b\s+\bSELECT\b)/i,
  /(\bSELECT\b.+\bFROM\b)/i,
  /(\bINSERT\b\s+\bINTO\b)/i,
  /(\bUPDATE\b.+\bSET\b)/i,
  /(\bDELETE\b\s+\bFROM\b)/i,
  /(\bDROP\b\s+\bTABLE\b)/i,
  /(\bALTER\b\s+\bTABLE\b)/i,
  /(\bTRUNCATE\b\s+\bTABLE\b)/i,
  /('|")\s*OR\s*('|")?\d+('|")?\s*=\s*('|")?\d+/i,
  /('|")\s*OR\s*('|")?[a-zA-Z0-9_]+('|")?\s*=\s*('|")?[a-zA-Z0-9_]+/i,
  /--/,
  /\/\*/,
  /\*\//,
  /;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE)\b/i
];

function stringifyValue(value) {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function hasSqlInjection(value) {
  const text = stringifyValue(value);

  return sqlInjectionPatterns.some((pattern) => pattern.test(text));
}

function scanObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  return Object.values(obj).some((value) => {
    if (value && typeof value === 'object') {
      return scanObject(value);
    }

    return hasSqlInjection(value);
  });
}

function sqlInjectionProtection(req, res, next) {
  const suspicious =
    hasSqlInjection(req.originalUrl) ||
    scanObject(req.query) ||
    scanObject(req.params) ||
    scanObject(req.body);

  if (!suspicious) {
    return next();
  }

  console.warn(
    JSON.stringify({
      level: 'warn',
      event: 'SQL_INJECTION_ATTEMPT_BLOCKED',
      requestId: req.headers['x-request-id'] || null,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      timestamp: new Date().toISOString()
    })
  );

  return res.status(400).json({
    success: false,
    message: 'Invalid request payload',
    errorCode: 'INVALID_REQUEST_SECURITY_CHECK',
    requestId: req.headers['x-request-id'] || null
  });
}

module.exports = sqlInjectionProtection;