'use strict';

const express = require('express');
const db = require('../config/database');

const router = express.Router();

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function parsePositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function buildAuditLogWhereClause(query) {
  const where = [];
  const values = [];

  const search = normalizeText(query.search);
  const logType = normalizeUpper(query.logType);
  const severity = normalizeUpper(query.severity);

  if (search) {
    values.push(`%${search}%`);
    const idx = values.length;

    where.push(`
      (
        actor_name ILIKE $${idx}
        OR actor_id ILIKE $${idx}
        OR created_by ILIKE $${idx}
        OR action_name ILIKE $${idx}
        OR action ILIKE $${idx}
        OR event_description ILIKE $${idx}
        OR module_name ILIKE $${idx}
        OR entity_type ILIKE $${idx}
        OR source_system ILIKE $${idx}
        OR request_id ILIKE $${idx}
        OR correlation_id ILIKE $${idx}
        OR ip_address::text ILIKE $${idx}
        OR source_ip::text ILIKE $${idx}
        OR error_message ILIKE $${idx}
      )
    `);
  }

  if (severity && severity !== 'ALL' && severity !== 'ALL SEVERITIES') {
    values.push(severity);
    const idx = values.length;

    where.push(`
      UPPER(COALESCE(severity, status, event_status, action_status, 'INFO')) = $${idx}
    `);
  }

  if (logType && logType !== 'ALL' && logType !== 'ALL LOG TYPES') {
    if (logType === 'GOVERNMENT_BLOCKCHAIN' || logType === 'GOVERNMENT BLOCKCHAIN') {
      where.push(`
        UPPER(COALESCE(module_name, entity_type, source_system, '')) = 'GOVERNMENT_BLOCKCHAIN'
      `);
    } else if (logType === 'WALLET') {
      where.push(`
        UPPER(COALESCE(module_name, entity_type, source_system, '')) = 'WALLET'
      `);
    } else if (logType === 'TRANSACTION') {
      where.push(`
        UPPER(COALESCE(module_name, entity_type, source_system, '')) = 'TRANSACTION'
      `);
    } else if (logType === 'DATABASE_SCHEMA' || logType === 'DATABASE SCHEMA') {
      where.push(`
        UPPER(COALESCE(module_name, entity_type, source_system, '')) = 'DATABASE_SCHEMA'
      `);
    } else if (logType === 'WALLET_LOGIN' || logType === 'WALLET LOGIN') {
      where.push(`
        UPPER(COALESCE(action_name, action, event_description, '')) = 'WALLET_LOGIN'
      `);
    } else if (logType === 'RESIDENT_CREATION' || logType === 'RESIDENT CREATION') {
      where.push(`
        UPPER(COALESCE(action_name, action, event_description, '')) = 'CREATE_RESIDENT'
      `);
    } else if (logType === 'RESIDENT_WALLET_CREATION' || logType === 'RESIDENT WALLET CREATION') {
      where.push(`
        UPPER(COALESCE(action_name, action, event_description, '')) = 'CREATE_RESIDENT_WALLET'
      `);
    } else if (logType === 'RESIDENT_KYC_SUBMISSION' || logType === 'RESIDENT KYC SUBMISSION') {
      where.push(`
        UPPER(COALESCE(action_name, action, event_description, '')) = 'SUBMIT_RESIDENT_KYC'
      `);
    } else if (logType === 'WALLET_TRANSFER' || logType === 'WALLET TRANSFER') {
      where.push(`
        UPPER(COALESCE(action_name, action, event_description, '')) IN (
          'WALLET_TO_WALLET_TRANSFER_REQUESTED',
          'WALLET_TO_WALLET_TRANSFER_COMPLETED'
        )
      `);
    }
  }

  return {
    whereSql: where.length ? `WHERE ${where.join('\nAND ')}` : '',
    values
  };
}

router.get('/summary', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*)::int AS "totalLogs",

        COUNT(*) FILTER (
          WHERE actor_id IS NOT NULL
             OR actor_name IS NOT NULL
             OR created_by IS NOT NULL
        )::int AS "userActions",

        COUNT(*) FILTER (
          WHERE
            COALESCE(action_name, action, event_description, '') <> 'SCHEMA_CREATED_OR_VALIDATED'
        )::int AS "apiEvents",

        COUNT(*) FILTER (
          WHERE
            UPPER(COALESCE(action_name, action, event_description, '')) LIKE '%LOGIN%'
            OR UPPER(COALESCE(action_name, action, event_description, '')) LIKE '%SECURITY%'
            OR UPPER(COALESCE(event_category, action_category, '')) LIKE '%SECURITY%'
            OR UPPER(COALESCE(severity, status, event_status, action_status, '')) IN (
              'HIGH',
              'CRITICAL',
              'ERROR',
              'FAILED'
            )
        )::int AS "securityAlerts"
      FROM blockchain.audit_logs
    `);

    return res.status(200).json({
      success: true,
      message: 'Audit logs summary loaded successfully.',
      data: result.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AUDIT_LOGS_SUMMARY_ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load audit logs summary.',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 100000);
    const limit = parsePositiveInt(req.query.limit, 25, 100);
    const offset = (page - 1) * limit;

    const { whereSql, values } = buildAuditLogWhereClause(req.query);

    const countResult = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM blockchain.audit_logs
      ${whereSql}
      `,
      values
    );

    const dataValues = [...values, limit, offset];

    const dataResult = await db.query(
      `
      SELECT
        COALESCE(audit_id::text, audit_log_id::text) AS "logId",
        COALESCE(actor_name, actor_id, created_by, 'unknown') AS "userName",
        COALESCE(action_name, action, event_description, 'UNKNOWN') AS "action",
        COALESCE(module_name, entity_type, source_system, 'UNKNOWN') AS "moduleName",
        COALESCE(ip_address::text, source_ip::text, 'N/A') AS "ipAddress",
        COALESCE(severity, status, event_status, action_status, 'INFO') AS "severity",
        COALESCE(event_at, created_at) AS "eventDate",

        audit_log_id::text AS "auditLogId",
        audit_id::text AS "auditId",
        correlation_id AS "correlationId",
        request_id AS "requestId",
        entity_type AS "entityType",
        entity_id AS "entityId",
        action_category AS "actionCategory",
        actor_type AS "actorType",
        source_system AS "sourceSystem",
        event_type AS "eventType",
        event_status AS "eventStatus",
        action_status AS "actionStatus",
        error_code AS "errorCode",
        error_message AS "errorMessage",
        request_source AS "requestSource",
        event_category AS "eventCategory",
        event_description AS "eventDescription",
        created_at AS "createdAt"
      FROM blockchain.audit_logs
      ${whereSql}
      ORDER BY COALESCE(event_at, created_at) DESC NULLS LAST
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
      `,
      dataValues
    );

    return res.status(200).json({
      success: true,
      message: 'Audit logs loaded successfully.',
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0]?.total || 0,
        totalPages: Math.ceil((countResult.rows[0]?.total || 0) / limit)
      },
      filters: {
        search: req.query.search || '',
        logType: req.query.logType || 'ALL',
        severity: req.query.severity || 'ALL'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AUDIT_LOGS_LIST_ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load audit logs.',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
