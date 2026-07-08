const db = require('../config/database');

const SERVICE_NAME = 'data-change-high-risk-alert-service';

class HighRiskAlertError extends Error {
  constructor(message, statusCode = 400, code = 'HIGH_RISK_ALERT_ERROR') {
    super(message);
    this.name = 'HighRiskAlertError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeText(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();
  return text || fallback;
}

function normalizeUpper(value, fallback = '') {
  return normalizeText(value, fallback).toUpperCase();
}

function toPositiveInt(value, fallback = 100, min = 1, max = 1000) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}


async function getDbClient() {
  if (typeof db.connect === 'function') {
    return db.connect();
  }

  if (typeof db.getClient === 'function') {
    return db.getClient();
  }

  if (db.pool && typeof db.pool.connect === 'function') {
    return db.pool.connect();
  }

  if (typeof db.getPool === 'function') {
    return db.getPool().connect();
  }

  throw new HighRiskAlertError(
    'PostgreSQL client is not available.',
    500,
    'DB_CLIENT_NOT_AVAILABLE'
  );
}

function changedFieldsContain(row, patterns = []) {
  const changed = row.changed_fields || {};
  const text = JSON.stringify(changed).toLowerCase();
  return patterns.some((pattern) => text.includes(pattern.toLowerCase()));
}

function tableContains(row, patterns = []) {
  const table = normalizeText(row.table_name).toLowerCase();
  const sourceView = normalizeText(row.source_view_name).toLowerCase();
  const moduleName = normalizeText(row.module_name).toLowerCase();

  return patterns.some((pattern) => {
    const p = pattern.toLowerCase();
    return table.includes(p) || sourceView.includes(p) || moduleName.includes(p);
  });
}

function evaluateRules(row) {
  const operation = normalizeUpper(row.operation_type);
  const rules = [];

  if (tableContains(row, ['aml_rule', 'business_rule', 'br_business_rule']) && operation === 'UPDATE') {
    rules.push({
      code: 'AML_RULE_UPDATED',
      name: 'AML rule updated',
      severity: 'CRITICAL',
      riskLevel: 'CRITICAL',
      riskScore: 95,
      reason: 'AML/business rule configuration was updated and requires compliance review.'
    });
  }

  if (tableContains(row, ['sanction']) && operation === 'DELETE') {
    rules.push({
      code: 'SANCTION_LIST_DELETED',
      name: 'Sanction list record deleted',
      severity: 'CRITICAL',
      riskLevel: 'CRITICAL',
      riskScore: 100,
      reason: 'Sanction list data was deleted and requires immediate compliance review.'
    });
  }

  if (tableContains(row, ['customer', 'kyc']) && changedFieldsContain(row, ['name', 'customer_name', 'national', 'identity', 'passport', 'tin'])) {
    rules.push({
      code: 'CUSTOMER_IDENTITY_CHANGED',
      name: 'Customer identity field changed',
      severity: 'HIGH',
      riskLevel: 'HIGH',
      riskScore: 90,
      reason: 'Customer identity-related fields changed.'
    });
  }

  if (tableContains(row, ['transaction', 'fin_transaction']) && changedFieldsContain(row, ['amount', 'transaction_amount', 'converted_transaction_amount'])) {
    rules.push({
      code: 'TRANSACTION_AMOUNT_CHANGED',
      name: 'Transaction amount changed',
      severity: 'HIGH',
      riskLevel: 'HIGH',
      riskScore: 85,
      reason: 'Transaction amount-related fields changed.'
    });
  }

  if (tableContains(row, ['audit_log', 'audit']) && operation === 'DELETE') {
    rules.push({
      code: 'AUDIT_LOG_DELETED',
      name: 'Audit log deleted',
      severity: 'CRITICAL',
      riskLevel: 'CRITICAL',
      riskScore: 100,
      reason: 'Audit log data was deleted.'
    });
  }

  if (tableContains(row, ['legacy_kyc', 'valoores_customer_kyc', 'customer_kyc']) && ['INSERT', 'UPDATE', 'DELETE'].includes(operation)) {
    rules.push({
      code: 'LEGACY_KYC_MODIFIED',
      name: 'Legacy KYC data modified',
      severity: operation === 'DELETE' ? 'CRITICAL' : 'HIGH',
      riskLevel: operation === 'DELETE' ? 'CRITICAL' : 'HIGH',
      riskScore: operation === 'DELETE' ? 98 : 82,
      reason: 'Legacy or Valoores KYC table data was modified.'
    });
  }

  if (tableContains(row, ['case', 'aml_case']) && changedFieldsContain(row, ['closure', 'closed', 'close_status', 'case_status'])) {
    rules.push({
      code: 'CASE_CLOSURE_CHANGED',
      name: 'Case closure changed',
      severity: 'HIGH',
      riskLevel: 'HIGH',
      riskScore: 88,
      reason: 'Case closure or status-related fields changed.'
    });
  }

  if (changedFieldsContain(row, ['evidence', 'attachment', 'document', 'metadata', 'file_hash'])) {
    rules.push({
      code: 'EVIDENCE_METADATA_CHANGED',
      name: 'Evidence metadata changed',
      severity: 'HIGH',
      riskLevel: 'HIGH',
      riskScore: 86,
      reason: 'Evidence/document metadata changed.'
    });
  }

  if (operation === 'DELETE' && rules.length === 0) {
    rules.push({
      code: 'HIGH_RISK_DELETE',
      name: 'High-risk delete operation',
      severity: 'HIGH',
      riskLevel: 'HIGH',
      riskScore: 80,
      reason: 'Delete operation detected on audited business data.'
    });
  }

  return rules;
}

function mapAlertRow(row) {
  return {
    alertId: Number(row.alert_id),
    alertKey: row.alert_key,
    auditId: Number(row.audit_id),
    alertRuleCode: row.alert_rule_code,
    alertRuleName: row.alert_rule_name,
    severity: row.severity,
    riskLevel: row.risk_level,
    riskScore: Number(row.risk_score || 0),
    alertStatus: row.alert_status,
    schemaName: row.schema_name,
    tableName: row.table_name,
    moduleName: row.module_name,
    operationType: row.operation_type,
    primaryKeyValue: row.primary_key_value,
    changedFields: row.changed_fields,
    alertReason: row.alert_reason,
    evidence: row.evidence,
    blockchainKey: row.blockchain_key,
    auditEventHash: row.audit_event_hash,
    auditBatchId: row.audit_batch_id,
    blockchainTransactionId: row.blockchain_transaction_id,
    batchBlockchainTransactionId: row.batch_blockchain_transaction_id,
    changedByUser: row.changed_by_app_user || row.changed_by_db_user,
    changedByRole: row.changed_by_role,
    clientIp: row.client_ip,
    clientHostname: row.client_hostname,
    applicationName: row.application_name,
    changedAt: row.changed_at,
    createdAt: row.created_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    closureReason: row.closure_reason,
    updatedAt: row.updated_at
  };
}

async function getSummary() {
  const result = await db.query(`
    SELECT *
    FROM blockchain.v_data_change_high_risk_alerts_summary
  `);

  const row = result.rows[0] || {};

  return {
    totalAlerts: Number(row.total_alerts || 0),
    openAlerts: Number(row.open_alerts || 0),
    closedAlerts: Number(row.closed_alerts || 0),
    criticalAlerts: Number(row.critical_alerts || 0),
    highAlerts: Number(row.high_alerts || 0),
    mediumAlerts: Number(row.medium_alerts || 0),
    escalatedAlerts: Number(row.escalated_alerts || 0),
    latestAlertAt: row.latest_alert_at
  };
}

async function listCandidateAuditEvents(options = {}) {
  const limit = toPositiveInt(options.limit, 100, 1, 1000);
  const values = [];
  const conditions = [
    `NOT EXISTS (
      SELECT 1
      FROM blockchain.data_change_high_risk_alerts hra
      WHERE hra.audit_id = a.audit_id
    )`
  ];

  const dateFrom = normalizeText(options.dateFrom || options.date_from);
  if (dateFrom) {
    values.push(dateFrom);
    conditions.push(`a.changed_at >= $${values.length}::timestamptz`);
  }

  const dateTo = normalizeText(options.dateTo || options.date_to);
  if (dateTo) {
    values.push(dateTo);
    conditions.push(`a.changed_at <= $${values.length}::timestamptz`);
  }

  const moduleName = normalizeText(options.moduleName || options.module_name);
  if (moduleName && moduleName.toUpperCase() !== 'ALL') {
    values.push(`%${moduleName}%`);
    conditions.push(`a.module_name ILIKE $${values.length}`);
  }

  values.push(limit);

  const result = await db.query(
    `
      SELECT
        a.*
      FROM blockchain.data_change_audit a
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.changed_at ASC, a.audit_id ASC
      LIMIT $${values.length}
    `,
    values
  );

  return result.rows || [];
}

async function insertAlert(client, row, rule, createdBy) {
  const alertKey = `HIGH_RISK:${row.audit_id}:${rule.code}`;

  const result = await client.query(
    `
      INSERT INTO blockchain.data_change_high_risk_alerts (
        alert_key,
        audit_id,
        alert_rule_code,
        alert_rule_name,
        severity,
        risk_level,
        risk_score,
        alert_status,
        schema_name,
        table_name,
        module_name,
        operation_type,
        primary_key_value,
        changed_fields,
        alert_reason,
        evidence,
        blockchain_key,
        audit_event_hash,
        audit_batch_id,
        blockchain_transaction_id,
        batch_blockchain_transaction_id,
        changed_by_app_user,
        changed_by_db_user,
        changed_by_role,
        client_ip,
        client_hostname,
        application_name,
        changed_at,
        created_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,'OPEN',$8,$9,$10,$11,$12,$13::jsonb,$14,$15::jsonb,
        $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
      )
      ON CONFLICT (audit_id, alert_rule_code)
      DO NOTHING
      RETURNING *
    `,
    [
      alertKey,
      row.audit_id,
      rule.code,
      rule.name,
      rule.severity,
      rule.riskLevel,
      rule.riskScore,
      row.schema_name,
      row.table_name,
      row.module_name,
      row.operation_type,
      row.primary_key_value,
      JSON.stringify(row.changed_fields || {}),
      rule.reason,
      JSON.stringify({
        ruleCode: rule.code,
        ruleName: rule.name,
        auditEventHash: row.audit_event_hash,
        oldRowHash: row.old_row_hash,
        newRowHash: row.new_row_hash,
        sourceViewName: row.source_view_name,
        blockchainStatus: row.blockchain_status,
        proofOnlyBlockchain: true
      }),
      row.blockchain_key,
      row.audit_event_hash,
      row.audit_batch_id,
      row.blockchain_transaction_id,
      row.batch_blockchain_transaction_id,
      row.changed_by_app_user,
      row.changed_by_db_user,
      row.changed_by_role,
      row.client_ip,
      row.client_hostname,
      row.application_name,
      row.changed_at,
      createdBy
    ]
  );

  return result.rows[0] || null;
}

async function updateAuditAlertStatus(client, auditId) {
  await client.query(
    `
      WITH alert_rollup AS (
        SELECT
          audit_id,
          COUNT(*) FILTER (
            WHERE alert_status IN ('OPEN', 'PENDING_REVIEW', 'UNDER_REVIEW', 'ESCALATED')
          )::int AS active_alert_count,
          MAX(risk_score) FILTER (
            WHERE alert_status IN ('OPEN', 'PENDING_REVIEW', 'UNDER_REVIEW', 'ESCALATED')
          )::int AS active_highest_risk_score,
          MAX(created_at) FILTER (
            WHERE alert_status IN ('OPEN', 'PENDING_REVIEW', 'UNDER_REVIEW', 'ESCALATED')
          ) AS active_latest_alert_at,
          CASE
            WHEN COUNT(*) FILTER (WHERE alert_status = 'ESCALATED') > 0 THEN 'ESCALATED'
            WHEN COUNT(*) FILTER (WHERE alert_status = 'UNDER_REVIEW') > 0 THEN 'UNDER_REVIEW'
            WHEN COUNT(*) FILTER (WHERE alert_status = 'PENDING_REVIEW') > 0 THEN 'PENDING_REVIEW'
            WHEN COUNT(*) FILTER (WHERE alert_status = 'OPEN') > 0 THEN 'OPEN'
            WHEN COUNT(*) FILTER (WHERE alert_status IN ('CLOSED', 'FALSE_POSITIVE')) > 0 THEN 'CLOSED'
            ELSE 'NO_ALERT'
          END AS computed_status
        FROM blockchain.data_change_high_risk_alerts
        WHERE audit_id = $1
        GROUP BY audit_id
      )
      UPDATE blockchain.data_change_audit a
      SET
        high_risk_alert_status = COALESCE(s.computed_status, 'NO_ALERT'),
        high_risk_alert_count = COALESCE(s.active_alert_count, 0),
        highest_risk_level = CASE
          WHEN COALESCE(s.active_alert_count, 0) = 0 THEN NULL
          WHEN s.active_highest_risk_score >= 95 THEN 'CRITICAL'
          WHEN s.active_highest_risk_score >= 80 THEN 'HIGH'
          ELSE 'MEDIUM'
        END,
        highest_risk_score = CASE
          WHEN COALESCE(s.active_alert_count, 0) = 0 THEN NULL
          ELSE s.active_highest_risk_score
        END,
        latest_high_risk_alert_at = s.active_latest_alert_at,
        compliance_status = CASE
          WHEN COALESCE(s.active_alert_count, 0) > 0 THEN 'PENDING_REVIEW'
          ELSE compliance_status
        END,
        approval_status = CASE
          WHEN COALESCE(s.active_alert_count, 0) > 0 THEN 'MANUAL_REQUIRED'
          ELSE approval_status
        END
      FROM alert_rollup s
      WHERE a.audit_id = s.audit_id
    `,
    [auditId]
  );
}

async function scanAndCreateAlerts(options = {}) {
  const dryRun = options.dryRun === true || String(options.dryRun) === 'true';
  const createdBy = normalizeText(options.createdBy || options.created_by, SERVICE_NAME);
  const candidates = await listCandidateAuditEvents(options);

  const evaluated = candidates.map((row) => ({
    row,
    rules: evaluateRules(row)
  })).filter((item) => item.rules.length > 0);

  if (dryRun) {
    return {
      created: false,
      dryRun: true,
      scannedCount: candidates.length,
      matchedAuditEventCount: evaluated.length,
      alertCount: evaluated.reduce((sum, item) => sum + item.rules.length, 0),
      matches: evaluated.map((item) => ({
        auditId: Number(item.row.audit_id),
        tableName: item.row.table_name,
        moduleName: item.row.module_name,
        operationType: item.row.operation_type,
        rules: item.rules
      }))
    };
  }

  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    const createdAlerts = [];

    for (const item of evaluated) {
      for (const rule of item.rules) {
        const alert = await insertAlert(client, item.row, rule, createdBy);
        if (alert) {
          createdAlerts.push(alert);
        }
      }

      await updateAuditAlertStatus(client, item.row.audit_id);
    }

    await client.query('COMMIT');

    return {
      created: true,
      dryRun: false,
      scannedCount: candidates.length,
      matchedAuditEventCount: evaluated.length,
      alertCount: createdAlerts.length,
      alerts: createdAlerts.map(mapAlertRow)
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (typeof client.release === 'function') {
      client.release();
    }
  }
}

async function listAlerts(options = {}) {
  const values = [];
  const conditions = [];
  const limit = toPositiveInt(options.limit, 50, 1, 500);
  const offset = toPositiveInt(options.offset, 0, 0, 1000000);

  function addEqual(column, value) {
    const text = normalizeUpper(value);
    if (!text || text === 'ALL') return;
    values.push(text);
    conditions.push(`UPPER(${column}) = $${values.length}`);
  }

  addEqual('alert_status', options.status || options.alertStatus);
  addEqual('risk_level', options.riskLevel);
  addEqual('severity', options.severity);
  addEqual('alert_rule_code', options.ruleCode);

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  values.push(limit);
  const limitIndex = values.length;
  values.push(offset);
  const offsetIndex = values.length;

  const result = await db.query(
    `
      SELECT *
      FROM blockchain.data_change_high_risk_alerts
      ${whereSql}
      ORDER BY created_at DESC, alert_id DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `,
    values
  );

  const countResult = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM blockchain.data_change_high_risk_alerts
      ${whereSql}
    `,
    values.slice(0, values.length - 2)
  );

  return {
    rows: result.rows.map(mapAlertRow),
    pagination: {
      total: Number(countResult.rows[0]?.total || 0),
      limit,
      offset
    }
  };
}

async function getAlert(alertIdOrKey) {
  const key = normalizeText(alertIdOrKey);
  if (!key) {
    throw new HighRiskAlertError('alertIdOrKey is required.');
  }

  const result = await db.query(
    `
      SELECT *
      FROM blockchain.data_change_high_risk_alerts
      WHERE alert_id::text = $1
         OR alert_key = $1
      LIMIT 1
    `,
    [key]
  );

  if (!result.rows[0]) {
    throw new HighRiskAlertError(`High-risk alert not found: ${key}`, 404, 'HIGH_RISK_ALERT_NOT_FOUND');
  }

  return mapAlertRow(result.rows[0]);
}

async function updateAlertStatus(alertIdOrKey, options = {}) {
  const key = normalizeText(alertIdOrKey);
  const status = normalizeUpper(options.status || options.alertStatus);
  const actor = normalizeText(options.reviewedBy || options.closedBy || options.user, SERVICE_NAME);
  const notes = normalizeText(options.notes || options.reviewNotes || options.closureReason);

  if (!['OPEN', 'PENDING_REVIEW', 'UNDER_REVIEW', 'ESCALATED', 'CLOSED', 'FALSE_POSITIVE'].includes(status)) {
    throw new HighRiskAlertError('Valid status is required.');
  }

  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE blockchain.data_change_high_risk_alerts
        SET
          alert_status = $2,
          reviewed_by = CASE WHEN $2 IN ('PENDING_REVIEW', 'UNDER_REVIEW', 'ESCALATED') THEN $3 ELSE reviewed_by END,
          reviewed_at = CASE WHEN $2 IN ('PENDING_REVIEW', 'UNDER_REVIEW', 'ESCALATED') THEN now() ELSE reviewed_at END,
          review_notes = CASE WHEN $2 IN ('PENDING_REVIEW', 'UNDER_REVIEW', 'ESCALATED') THEN $4 ELSE review_notes END,
          closed_by = CASE WHEN $2 IN ('CLOSED', 'FALSE_POSITIVE') THEN $3 ELSE closed_by END,
          closed_at = CASE WHEN $2 IN ('CLOSED', 'FALSE_POSITIVE') THEN now() ELSE closed_at END,
          closure_reason = CASE WHEN $2 IN ('CLOSED', 'FALSE_POSITIVE') THEN $4 ELSE closure_reason END,
          updated_at = now()
        WHERE alert_id::text = $1
           OR alert_key = $1
        RETURNING *
      `,
      [key, status, actor, notes]
    );

    if (!result.rows[0]) {
      throw new HighRiskAlertError(`High-risk alert not found: ${key}`, 404, 'HIGH_RISK_ALERT_NOT_FOUND');
    }

    await updateAuditAlertStatus(client, result.rows[0].audit_id);

    await client.query('COMMIT');

    return mapAlertRow(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (typeof client.release === 'function') {
      client.release();
    }
  }
}

module.exports = {
  SERVICE_NAME,
  HighRiskAlertError,
  evaluateRules,
  getSummary,
  listCandidateAuditEvents,
  scanAndCreateAlerts,
  listAlerts,
  getAlert,
  updateAlertStatus
};
