'use strict';

const db = require('../config/database');

function safeJson(value) {
  if (value === undefined || value === null) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return {
      warning: 'Unable to serialize payload',
      message: error.message
    };
  }
}

function maskSensitiveData(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload || null;
  }

  const cloned = safeJson(payload);

  const sensitiveFields = [
    'password',
    'passwordHash',
    'token',
    'accessToken',
    'refreshToken',
    'authorization',
    'apiKey',
    'x-api-key',
    'secret',
    'privateKey',
    'mnemonic',
    'recoveryWords',
    'otp'
  ];

  function maskObject(obj) {
    if (!obj || typeof obj !== 'object') return;

    Object.keys(obj).forEach((key) => {
      const lowerKey = key.toLowerCase();

      if (
        sensitiveFields.some((field) =>
          lowerKey.includes(field.toLowerCase())
        )
      ) {
        obj[key] = '***MASKED***';
      } else if (typeof obj[key] === 'object') {
        maskObject(obj[key]);
      }
    });
  }

  maskObject(cloned);
  return cloned;
}

async function executeQuery(query, values) {
  if (!db) {
    throw new Error('Database module is not loaded');
  }

  if (typeof db.query === 'function') {
    return db.query(query, values);
  }

  if (db.pool && typeof db.pool.query === 'function') {
    return db.pool.query(query, values);
  }

  if (db.client && typeof db.client.query === 'function') {
    return db.client.query(query, values);
  }

  throw new Error(
    'Database config does not expose query(), pool.query(), or client.query()'
  );
}

class AuditService {
  async log(event = {}) {
    try {
      const query = `
        INSERT INTO blockchain.blockchain_audit_log (
          request_id,
          correlation_id,
          event_type,
          event_category,
          event_status,
          source_system,
          request_source,
          http_method,
          endpoint,
          controller_name,
          service_name,
          customer_id,
          organization_id,
          organization_code,
          wallet_address,
          transaction_id,
          fabric_tx_id,
          blockchain_function,
          chaincode_name,
          channel_name,
          ip_address,
          user_agent,
          request_payload,
          response_payload,
          metadata,
          error_code,
          error_message,
          error_stack,
          duration_ms,
          created_by
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25,
          $26, $27, $28, $29, $30
        )
        RETURNING audit_id, created_at
      `;

      const values = [
        event.requestId || event.request_id || null,
        event.correlationId || event.correlation_id || null,

        event.eventType || event.event_type || 'UNKNOWN_EVENT',
        event.eventCategory || event.event_category || 'SYSTEM',
        event.eventStatus || event.event_status || 'SUCCESS',

        event.sourceSystem || event.source_system || null,
        event.requestSource || event.request_source || null,

        event.httpMethod || event.http_method || null,
        event.endpoint || null,
        event.controllerName || event.controller_name || null,
        event.serviceName || event.service_name || null,

        event.customerId || event.customer_id || null,
        event.organizationId || event.organization_id || null,
        event.organizationCode || event.organization_code || null,
        event.walletAddress || event.wallet_address || null,

        event.transactionId || event.transaction_id || null,
        event.fabricTxId || event.fabric_tx_id || null,
        event.blockchainFunction || event.blockchain_function || null,
        event.chaincodeName ||
          event.chaincode_name ||
          process.env.FABRIC_CHAINCODE_NAME ||
          null,
        event.channelName ||
          event.channel_name ||
          process.env.FABRIC_CHANNEL_NAME ||
          null,

        event.ipAddress || event.ip_address || null,
        event.userAgent || event.user_agent || null,

        maskSensitiveData(event.requestPayload || event.request_payload || null),
        maskSensitiveData(event.responsePayload || event.response_payload || null),
        safeJson(event.metadata || null),

        event.errorCode || event.error_code || null,
        event.errorMessage || event.error_message || null,
        event.errorStack || event.error_stack || null,

        event.durationMs || event.duration_ms || null,
        event.createdBy || event.created_by || 'system'
      ];

      const result = await executeQuery(query, values);

      return {
        success: true,
        auditId: result.rows?.[0]?.audit_id || null,
        createdAt: result.rows?.[0]?.created_at || null
      };
    } catch (error) {
      console.error('Audit log insert failed:', {
        message: error.message,
        stack: error.stack,
        requestId: event.requestId || event.request_id || null,
        correlationId: event.correlationId || event.correlation_id || null,
        eventType: event.eventType || event.event_type || null
      });

      return {
        success: false,
        message: error.message
      };
    }
  }

  buildRequestContext(req) {
    return {
      requestId: req.requestId || req.headers?.['x-request-id'] || null,
      correlationId:
        req.correlationId ||
        req.headers?.['x-correlation-id'] ||
        req.requestId ||
        null,
      sourceSystem:
        req.sourceSystem ||
        req.headers?.['x-source-system'] ||
        req.body?.sourceSystem ||
        'BLOCKCHAIN_API',
      requestSource:
        req.requestSource ||
        req.headers?.['x-request-source'] ||
        req.body?.requestSource ||
        'API',
      httpMethod: req.method || null,
      endpoint: req.originalUrl || req.url || null,
      ipAddress:
        req.headers?.['x-forwarded-for'] ||
        req.socket?.remoteAddress ||
        req.ip ||
        null,
      userAgent: req.headers?.['user-agent'] || null,
      createdBy: req.user?.username || req.body?.createdBy || 'system'
    };
  }
}

module.exports = new AuditService();