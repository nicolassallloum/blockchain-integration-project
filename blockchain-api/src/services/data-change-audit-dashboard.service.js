const db = require('../config/database');

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const RISK_LEVEL_SQL = `
  CASE
    WHEN UPPER(COALESCE(a.operation_type, '')) = 'DELETE' THEN 'HIGH'
    WHEN a.table_name ILIKE '%sanction%' THEN 'HIGH'
    WHEN a.table_name ILIKE '%risk%' THEN 'HIGH'
    WHEN a.module_name ILIKE '%AML%' THEN 'HIGH'
    WHEN UPPER(COALESCE(a.operation_type, '')) = 'UPDATE' THEN 'MEDIUM'
    ELSE 'LOW'
  END
`;

const VERIFICATION_STATUS_SQL = `
  CASE
    WHEN UPPER(COALESCE(a.validation_status, '')) IN ('INVALID', 'FAILED') THEN 'INVALID'
    WHEN UPPER(COALESCE(a.blockchain_status, '')) IN ('MISMATCH', 'MISMATCHED') THEN 'MISMATCHED'
    WHEN a.blockchain_transaction_id IS NOT NULL THEN 'VERIFIED'
    WHEN UPPER(COALESCE(a.blockchain_status, '')) IN ('SUBMITTED', 'CONFIRMED') THEN 'VERIFIED'
    ELSE 'NOT_VERIFIED'
  END
`;

const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /tin/i,
  /ssn/i,
  /national/i,
  /phone/i,
  /email/i,
  /address/i,
  /name/i,
  /dob/i,
  /birth/i,
  /iban/i,
  /account/i,
  /customer/i
];

const SENSITIVE_ALLOWED_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'COMPLIANCE_ADMIN',
  'AUDIT_ADMIN',
  'DATA_AUDIT_ADMIN'
]);

class DataChangeAuditDashboardError extends Error {
  constructor(message, statusCode = 400, code = 'DATA_CHANGE_AUDIT_DASHBOARD_ERROR') {
    super(message);
    this.name = 'DataChangeAuditDashboardError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeText(value, fallback = null) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const normalized = String(value).trim();
  return normalized || fallback;
}

function normalizeInteger(value, fallback = DEFAULT_LIMIT, min = 1, max = MAX_LIMIT) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function normalizeUpper(value, fallback = null) {
  const text = normalizeText(value, fallback);
  return text ? text.toUpperCase() : fallback;
}

function roleAllowsSensitiveRows(role) {
  const normalizedRole = normalizeUpper(role, '');
  return SENSITIVE_ALLOWED_ROLES.has(normalizedRole);
}

function addIlikeFilter(conditions, values, sqlColumn, value) {
  const text = normalizeText(value);
  if (!text || text.toUpperCase() === 'ALL') {
    return;
  }

  values.push(`%${text}%`);
  conditions.push(`${sqlColumn} ILIKE $${values.length}`);
}

function addEqualFilter(conditions, values, sqlExpression, value) {
  const text = normalizeText(value);
  if (!text || text.toUpperCase() === 'ALL') {
    return;
  }

  values.push(text.toUpperCase());
  conditions.push(`UPPER(COALESCE(${sqlExpression}, '')) = $${values.length}`);
}

function buildFilterWhere(filters = {}) {
  const conditions = [];
  const values = [];

  addIlikeFilter(conditions, values, 'a.table_name', filters.tableName);
  addIlikeFilter(conditions, values, 'a.module_name', filters.moduleName);
  addEqualFilter(conditions, values, 'a.operation_type', filters.operationType);

  const userFilter = normalizeText(filters.user || filters.changedByUser);
  if (userFilter && userFilter.toUpperCase() !== 'ALL') {
    values.push(`%${userFilter}%`);
    conditions.push(`(
      COALESCE(a.changed_by_app_user, '') ILIKE $${values.length}
      OR COALESCE(a.changed_by_db_user, '') ILIKE $${values.length}
    )`);
  }

  addIlikeFilter(conditions, values, 'a.changed_by_role', filters.role);
  addIlikeFilter(conditions, values, 'a.client_ip', filters.clientIp);
  addIlikeFilter(conditions, values, 'a.client_hostname', filters.clientHostname);
  addEqualFilter(conditions, values, 'a.blockchain_status', filters.blockchainStatus);
  addEqualFilter(conditions, values, 'a.approval_status', filters.approvalStatus);

  const verificationStatus = normalizeUpper(filters.verificationStatus);
  if (verificationStatus && verificationStatus !== 'ALL') {
    values.push(verificationStatus);
    conditions.push(`${VERIFICATION_STATUS_SQL} = $${values.length}`);
  }

  const riskLevel = normalizeUpper(filters.riskLevel);
  if (riskLevel && riskLevel !== 'ALL') {
    values.push(riskLevel);
    conditions.push(`${RISK_LEVEL_SQL} = $${values.length}`);
  }

  const batchId = normalizeText(filters.batchId);
  if (batchId && batchId.toUpperCase() !== 'ALL') {
    const parsedBatchId = Number(batchId);
    if (Number.isInteger(parsedBatchId) && parsedBatchId > 0) {
      values.push(parsedBatchId);
      conditions.push(`a.audit_batch_id = $${values.length}`);
    }
  }

  const dateFrom = normalizeText(filters.dateFrom);
  if (dateFrom) {
    values.push(dateFrom);
    conditions.push(`a.changed_at >= $${values.length}::timestamptz`);
  }

  const dateTo = normalizeText(filters.dateTo);
  if (dateTo) {
    values.push(dateTo);
    conditions.push(`a.changed_at < ($${values.length}::date + INTERVAL '1 day')`);
  }

  return {
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values
  };
}

function mapAuditEventRow(row) {
  return {
    auditId: Number(row.audit_id),
    schemaName: row.schema_name,
    tableName: row.table_name,
    moduleName: row.module_name,
    primaryKeyColumn: row.primary_key_column,
    primaryKeyValue: row.primary_key_value,
    operationType: row.operation_type,
    changedFields: row.changed_fields,
    oldRowHash: row.old_row_hash,
    newRowHash: row.new_row_hash,
    auditEventHash: row.audit_event_hash,
    changedByUser: row.changed_by_app_user || row.changed_by_db_user,
    changedByAppUser: row.changed_by_app_user,
    changedByDbUser: row.changed_by_db_user,
    changedByRole: row.changed_by_role,
    clientIp: row.client_ip,
    clientHostname: row.client_hostname,
    applicationName: row.application_name,
    postgresTransactionId: row.postgres_transaction_id,
    changedAt: row.changed_at,
    blockchainKey: row.blockchain_key,
    blockchainTransactionId: row.blockchain_transaction_id,
    blockchainStatus: row.blockchain_status,
    blockchainSubmittedAt: row.blockchain_submitted_at,
    blockchainError: row.blockchain_error,
    validationStatus: row.validation_status,
    verificationStatus: row.verification_status,
    approvalStatus: row.approval_status,
    complianceStatus: row.compliance_status,
    auditBatchId: row.audit_batch_id,
    riskLevel: row.risk_level,
    highRiskAlertStatus: row.high_risk_alert_status,
    highRiskAlertCount: Number(row.high_risk_alert_count || 0),
    highestRiskLevel: row.highest_risk_level,
    highestRiskScore: row.highest_risk_score === null || row.highest_risk_score === undefined ? null : Number(row.highest_risk_score),
    latestHighRiskAlertAt: row.latest_high_risk_alert_at,
    invalidReviewId: row.invalid_review_id === null || row.invalid_review_id === undefined ? null : Number(row.invalid_review_id),
    invalidStatus: row.invalid_status,
    invalidReason: row.invalid_reason,
    invalidReviewStatus: row.invalid_review_status,
    reactivationStatus: row.reactivation_status,
    correctedAuditEventHash: row.corrected_audit_event_hash,
    correctedBlockchainKey: row.corrected_blockchain_key,
    correctedBlockchainTransactionId: row.corrected_blockchain_transaction_id,
    invalidDetectedAt: row.invalid_detected_at,
    invalidResolvedAt: row.invalid_resolved_at,
    complianceRuleStatus: row.compliance_rule_status,
    complianceRuleDecision: row.compliance_rule_decision,
    complianceRuleScore: row.compliance_rule_score === null || row.compliance_rule_score === undefined ? null : Number(row.compliance_rule_score),
    complianceRuleCodes: row.compliance_rule_codes,
    complianceRuleEvaluatedAt: row.compliance_rule_evaluated_at,
    complianceRuleEvaluatedBy: row.compliance_rule_evaluated_by,
    sourceViewName: row.source_view_name,
    createdAt: row.created_at
  };
}

function isSensitiveField(fieldName, configuredSensitiveFields = []) {
  const normalized = String(fieldName || '').toLowerCase();

  if (configuredSensitiveFields.some((field) => String(field || '').toLowerCase() === normalized)) {
    return true;
  }

  return SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(normalized));
}

function redactValue(value, configuredSensitiveFields = []) {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, configuredSensitiveFields));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value).reduce((acc, key) => {
    if (isSensitiveField(key, configuredSensitiveFields)) {
      acc[key] = '[REDACTED]';
    } else {
      acc[key] = redactValue(value[key], configuredSensitiveFields);
    }

    return acc;
  }, {});
}

async function getMetrics(filters = {}) {
  const filter = buildFilterWhere(filters);

  const result = await db.query(
    `
      WITH filtered AS (
        SELECT
          a.*,
          ${VERIFICATION_STATUS_SQL} AS verification_status,
          ${RISK_LEVEL_SQL} AS risk_level
        FROM blockchain.data_change_audit a
        ${filter.whereSql}
      )
      SELECT
        COUNT(*)::int AS total_audit_events,
        COUNT(*) FILTER (WHERE operation_type = 'INSERT')::int AS insert_events,
        COUNT(*) FILTER (WHERE operation_type = 'UPDATE')::int AS update_events,
        COUNT(*) FILTER (WHERE operation_type = 'DELETE')::int AS delete_events,
        COUNT(*) FILTER (
          WHERE blockchain_status IN ('SUBMITTED', 'CONFIRMED')
             OR blockchain_transaction_id IS NOT NULL
        )::int AS submitted_to_blockchain,
        COUNT(*) FILTER (WHERE blockchain_status = 'PENDING')::int AS pending_blockchain_submission,
        COUNT(*) FILTER (WHERE blockchain_status = 'FAILED')::int AS failed_blockchain_submission,
        COUNT(*) FILTER (WHERE verification_status = 'VERIFIED')::int AS verified_events,
        COUNT(*) FILTER (WHERE verification_status = 'MISMATCHED')::int AS mismatched_events,
        COUNT(*) FILTER (WHERE verification_status = 'INVALID')::int AS invalid_records,
        COUNT(*) FILTER (
          WHERE compliance_status IN ('REVIEW', 'UNDER_REVIEW', 'PENDING_REVIEW')
        )::int AS records_under_compliance_review,
        COUNT(*) FILTER (
          WHERE COALESCE(high_risk_alert_count, 0) > 0
        )::int AS high_risk_alerted_events,
        COUNT(*) FILTER (
          WHERE high_risk_alert_status IN ('OPEN', 'PENDING_REVIEW', 'UNDER_REVIEW', 'ESCALATED')
        )::int AS open_high_risk_alert_events,
        COUNT(*) FILTER (
          WHERE highest_risk_level = 'CRITICAL'
        )::int AS critical_high_risk_events,
        COUNT(*) FILTER (
          WHERE COALESCE(invalid_review_status, 'NO_REVIEW') <> 'NO_REVIEW'
        )::int AS invalid_review_events,
        COUNT(*) FILTER (
          WHERE invalid_review_status = 'UNDER_COMPLIANCE_REVIEW'
        )::int AS invalid_records_under_review,
        COUNT(*) FILTER (
          WHERE reactivation_status = 'REACTIVATED'
        )::int AS reactivated_records,
        COUNT(*) FILTER (
          WHERE compliance_rule_status = 'EVALUATED'
        )::int AS compliance_rule_evaluated_events,
        COUNT(*) FILTER (
          WHERE compliance_rule_decision = 'MANUAL_REVIEW'
        )::int AS compliance_rule_manual_review_events,
        COUNT(*) FILTER (
          WHERE compliance_rule_decision = 'AUTO_APPROVE'
        )::int AS compliance_rule_auto_approved_events,
        COUNT(*) FILTER (WHERE approval_status IN ('PENDING', 'BULK_PENDING'))::int AS bulk_approval_queue,
        COUNT(*) FILTER (WHERE approval_status = 'AUTO_APPROVED')::int AS auto_approved_changes,
        COUNT(*) FILTER (
          WHERE approval_status IN ('PENDING', 'MANUAL_REQUIRED', 'REQUIRES_MANUAL_APPROVAL')
        )::int AS manual_approval_required
      FROM filtered
    `,
    filter.values
  );

  const row = result.rows[0] || {};

  return {
    totalAuditEvents: Number(row.total_audit_events || 0),
    insertEvents: Number(row.insert_events || 0),
    updateEvents: Number(row.update_events || 0),
    deleteEvents: Number(row.delete_events || 0),
    submittedToBlockchain: Number(row.submitted_to_blockchain || 0),
    pendingBlockchainSubmission: Number(row.pending_blockchain_submission || 0),
    failedBlockchainSubmission: Number(row.failed_blockchain_submission || 0),
    verifiedEvents: Number(row.verified_events || 0),
    mismatchedEvents: Number(row.mismatched_events || 0),
    invalidRecords: Number(row.invalid_records || 0),
    recordsUnderComplianceReview: Number(row.records_under_compliance_review || 0),
    highRiskAlertedEvents: Number(row.high_risk_alerted_events || 0),
    openHighRiskAlertEvents: Number(row.open_high_risk_alert_events || 0),
    criticalHighRiskEvents: Number(row.critical_high_risk_events || 0),
    invalidReviewEvents: Number(row.invalid_review_events || 0),
    invalidRecordsUnderReview: Number(row.invalid_records_under_review || 0),
    reactivatedRecords: Number(row.reactivated_records || 0),
    complianceRuleEvaluatedEvents: Number(row.compliance_rule_evaluated_events || 0),
    complianceRuleManualReviewEvents: Number(row.compliance_rule_manual_review_events || 0),
    complianceRuleAutoApprovedEvents: Number(row.compliance_rule_auto_approved_events || 0),
    bulkApprovalQueue: Number(row.bulk_approval_queue || 0),
    autoApprovedChanges: Number(row.auto_approved_changes || 0),
    manualApprovalRequired: Number(row.manual_approval_required || 0)
  };
}

async function listAuditEvents(filters = {}, extraConditionSql = '') {
  const filter = buildFilterWhere(filters);
  const values = [...filter.values];
  const limit = normalizeInteger(filters.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = normalizeInteger(filters.offset, 0, 0, 1000000);

  const extraSql = extraConditionSql
    ? `${filter.whereSql ? 'AND' : 'WHERE'} ${extraConditionSql}`
    : '';

  const limitParam = values.push(limit);
  const offsetParam = values.push(offset);

  const rowsResult = await db.query(
    `
      SELECT
        a.audit_id,
        a.schema_name,
        a.table_name,
        a.module_name,
        a.primary_key_column,
        a.primary_key_value,
        a.operation_type,
        a.changed_fields,
        a.old_row_hash,
        a.new_row_hash,
        a.audit_event_hash,
        a.changed_by_app_user,
        a.changed_by_db_user,
        a.changed_by_role,
        a.client_ip,
        a.client_hostname,
        a.application_name,
        a.postgres_transaction_id,
        a.changed_at,
        a.blockchain_key,
        a.blockchain_transaction_id,
        a.blockchain_status,
        a.blockchain_submitted_at,
        a.blockchain_error,
        a.validation_status,
        ${VERIFICATION_STATUS_SQL} AS verification_status,
        a.approval_status,
        a.compliance_status,
        a.audit_batch_id,
        ${RISK_LEVEL_SQL} AS risk_level,
        a.high_risk_alert_status,
        a.high_risk_alert_count,
        a.highest_risk_level,
        a.highest_risk_score,
        a.latest_high_risk_alert_at,
        a.invalid_review_id,
        a.invalid_status,
        a.invalid_reason,
        a.invalid_review_status,
        a.reactivation_status,
        a.corrected_audit_event_hash,
        a.corrected_blockchain_key,
        a.corrected_blockchain_transaction_id,
        a.invalid_detected_at,
        a.invalid_resolved_at,
        a.compliance_rule_status,
        a.compliance_rule_decision,
        a.compliance_rule_score,
        a.compliance_rule_codes,
        a.compliance_rule_evaluated_at,
        a.compliance_rule_evaluated_by,
        a.source_view_name,
        a.created_at
      FROM blockchain.data_change_audit a
      ${filter.whereSql}
      ${extraSql}
      ORDER BY a.changed_at DESC, a.audit_id DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values
  );

  const countResult = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM blockchain.data_change_audit a
      ${filter.whereSql}
      ${extraSql}
    `,
    filter.values
  );

  return {
    filters,
    rows: rowsResult.rows.map(mapAuditEventRow),
    pagination: {
      total: Number(countResult.rows[0]?.total || 0),
      limit,
      offset
    },
    generatedAt: new Date().toISOString()
  };
}

async function getUserIpActivity(filters = {}) {
  const filter = buildFilterWhere(filters);

  const result = await db.query(
    `
      SELECT
        COALESCE(a.changed_by_app_user, a.changed_by_db_user, 'UNKNOWN') AS actor,
        COALESCE(a.changed_by_role, 'UNKNOWN') AS role,
        COALESCE(a.client_ip, 'UNKNOWN') AS client_ip,
        COALESCE(a.client_hostname, 'UNKNOWN') AS client_hostname,
        COUNT(*)::int AS total_events,
        COUNT(*) FILTER (WHERE a.operation_type = 'DELETE')::int AS delete_events,
        COUNT(*) FILTER (WHERE a.blockchain_status = 'FAILED')::int AS failed_blockchain_events,
        MAX(a.changed_at) AS latest_activity_at
      FROM blockchain.data_change_audit a
      ${filter.whereSql}
      GROUP BY
        COALESCE(a.changed_by_app_user, a.changed_by_db_user, 'UNKNOWN'),
        COALESCE(a.changed_by_role, 'UNKNOWN'),
        COALESCE(a.client_ip, 'UNKNOWN'),
        COALESCE(a.client_hostname, 'UNKNOWN')
      ORDER BY total_events DESC, latest_activity_at DESC
      LIMIT 25
    `,
    filter.values
  );

  return result.rows;
}

async function getDashboard(filters = {}) {
  const tableLimit = normalizeInteger(filters.limit, 10, 1, 50);

  const [
    metrics,
    latestDataChanges,
    highRiskChanges,
    deletedRecordsEvidence,
    failedBlockchainSubmissions,
    invalidOrMismatchedRecords,
    invalidRecordReviewQueue,
    complianceReviewQueue,
    complianceRuleReviewQueue,
    highRiskAlertQueue,
    bulkApprovalQueue,
    autoApprovedChanges,
    manualApprovalRequired,
    userIpActivity
  ] = await Promise.all([
    getMetrics(filters),
    listAuditEvents({ ...filters, limit: tableLimit, offset: 0 }),
    listAuditEvents({ ...filters, limit: tableLimit, offset: 0 }, `${RISK_LEVEL_SQL} IN ('HIGH', 'CRITICAL')`),
    listAuditEvents({ ...filters, limit: tableLimit, offset: 0 }, `a.operation_type = 'DELETE'`),
    listAuditEvents({ ...filters, limit: tableLimit, offset: 0 }, `a.blockchain_status = 'FAILED'`),
    listAuditEvents(
      { ...filters, limit: tableLimit, offset: 0 },
      `(${VERIFICATION_STATUS_SQL} IN ('INVALID', 'MISMATCHED'))`
    ),
    listAuditEvents(
      { ...filters, limit: tableLimit, offset: 0 },
      `COALESCE(a.invalid_review_status, 'NO_REVIEW') <> 'NO_REVIEW'`
    ),
    listAuditEvents(
      { ...filters, limit: tableLimit, offset: 0 },
      `a.compliance_status IN ('REVIEW', 'UNDER_REVIEW', 'PENDING_REVIEW')`
    ),
    listAuditEvents(
      { ...filters, limit: tableLimit, offset: 0 },
      `a.compliance_rule_decision IN ('MANUAL_REVIEW', 'PROOF_REQUIRED', 'BLOCK', 'REJECT')`
    ),
    listAuditEvents(
      { ...filters, limit: tableLimit, offset: 0 },
      `COALESCE(a.high_risk_alert_count, 0) > 0
       AND a.high_risk_alert_status IN ('OPEN', 'PENDING_REVIEW', 'UNDER_REVIEW', 'ESCALATED')`
    ),
    listAuditEvents(
      { ...filters, limit: tableLimit, offset: 0 },
      `a.approval_status IN ('PENDING', 'BULK_PENDING')`
    ),
    listAuditEvents(
      { ...filters, limit: tableLimit, offset: 0 },
      `a.approval_status = 'AUTO_APPROVED'`
    ),
    listAuditEvents(
      { ...filters, limit: tableLimit, offset: 0 },
      `a.approval_status IN ('PENDING', 'MANUAL_REQUIRED', 'REQUIRES_MANUAL_APPROVAL')`
    ),
    getUserIpActivity(filters)
  ]);

  return {
    filters,
    metrics,
    tables: {
      latestDataChanges: latestDataChanges.rows,
      highRiskChanges: highRiskChanges.rows,
      deletedRecordsEvidence: deletedRecordsEvidence.rows,
      failedBlockchainSubmissions: failedBlockchainSubmissions.rows,
      userIpActivity,
      invalidOrMismatchedRecords: invalidOrMismatchedRecords.rows,
      invalidRecordReviewQueue: invalidRecordReviewQueue.rows,
      complianceReviewQueue: complianceReviewQueue.rows,
      complianceRuleReviewQueue: complianceRuleReviewQueue.rows,
      highRiskAlertQueue: highRiskAlertQueue.rows,
      bulkApprovalQueue: bulkApprovalQueue.rows,
      autoApprovedChanges: autoApprovedChanges.rows,
      manualApprovalRequired: manualApprovalRequired.rows
    },
    generatedAt: new Date().toISOString()
  };
}

async function getAuditEventDetail(auditId, options = {}) {
  const normalizedAuditId = Number(auditId);

  if (!Number.isInteger(normalizedAuditId) || normalizedAuditId < 1) {
    throw new DataChangeAuditDashboardError('Valid auditId is required', 400, 'INVALID_AUDIT_ID');
  }

  const result = await db.query(
    `
      SELECT
        a.*,
        ${VERIFICATION_STATUS_SQL} AS verification_status,
        ${RISK_LEVEL_SQL} AS risk_level,
        COALESCE(c.sensitive_fields, ARRAY[]::text[]) AS sensitive_fields
      FROM blockchain.data_change_audit a
      LEFT JOIN blockchain.data_change_audit_config c
        ON c.schema_name = a.schema_name
       AND c.table_name = a.table_name
      WHERE a.audit_id = $1
      LIMIT 1
    `,
    [normalizedAuditId]
  );

  if (result.rows.length === 0) {
    throw new DataChangeAuditDashboardError(
      `Audit event not found: ${normalizedAuditId}`,
      404,
      'AUDIT_EVENT_NOT_FOUND'
    );
  }

  const row = result.rows[0];
  const configuredSensitiveFields = row.sensitive_fields || [];
  const allowSensitiveRows = options.allowSensitiveRows === true;

  return {
    ...mapAuditEventRow(row),
    access: {
      oldNewRowsVisible: allowSensitiveRows,
      redacted: !allowSensitiveRows,
      message: allowSensitiveRows
        ? 'Full old/new row payload visible for privileged audit role.'
        : 'Old/new row payload is redacted. Hashes remain visible for proof verification.'
    },
    primaryKeyJson: row.primary_key_json,
    oldRowJson: allowSensitiveRows
      ? row.old_row_json
      : redactValue(row.old_row_json, configuredSensitiveFields),
    newRowJson: allowSensitiveRows
      ? row.new_row_json
      : redactValue(row.new_row_json, configuredSensitiveFields),
    changedFields: allowSensitiveRows
      ? row.changed_fields
      : redactValue(row.changed_fields, configuredSensitiveFields),
    sensitiveFieldsApplied: allowSensitiveRows ? [] : configuredSensitiveFields
  };
}


function normalizeExportFormat(value) {
  const format = String(value || 'JSON').trim().toUpperCase();

  if (['JSON', 'CSV'].includes(format)) {
    return format;
  }

  return 'JSON';
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = typeof value === 'object'
    ? JSON.stringify(value)
    : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function buildCsvContent(headers, rows) {
  return [
    headers.map((header) => escapeCsvValue(header.label)).join(','),
    ...rows.map((row) =>
      headers
        .map((header) => escapeCsvValue(row[header.key]))
        .join(',')
    )
  ].join('\n');
}

function getExportTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function buildExportFileName(format) {
  return `data-change-audit-evidence-${getExportTimestamp()}.${format.toLowerCase()}`;
}

function getExportHeaders() {
  return [
    { key: 'auditId', label: 'Audit ID' },
    { key: 'changedAt', label: 'Changed At' },
    { key: 'schemaName', label: 'Schema Name' },
    { key: 'tableName', label: 'Table Name' },
    { key: 'moduleName', label: 'Module Name' },
    { key: 'operationType', label: 'Operation Type' },
    { key: 'primaryKeyColumn', label: 'Primary Key Column' },
    { key: 'primaryKeyValue', label: 'Primary Key Value' },
    { key: 'changedFields', label: 'Changed Fields' },
    { key: 'oldRowHash', label: 'Old Row Hash' },
    { key: 'newRowHash', label: 'New Row Hash' },
    { key: 'auditEventHash', label: 'Audit Event Hash' },
    { key: 'blockchainKey', label: 'Blockchain Key' },
    { key: 'blockchainTransactionId', label: 'Blockchain Transaction ID' },
    { key: 'blockchainStatus', label: 'Blockchain Status' },
    { key: 'verificationStatus', label: 'Verification Status' },
    { key: 'validationStatus', label: 'Validation Status' },
    { key: 'approvalStatus', label: 'Approval Status' },
    { key: 'complianceStatus', label: 'Compliance Status' },
    { key: 'auditBatchId', label: 'Batch ID' },
    { key: 'riskLevel', label: 'Risk Level' },
    { key: 'highRiskAlertStatus', label: 'High-Risk Alert Status' },
    { key: 'highRiskAlertCount', label: 'High-Risk Alert Count' },
    { key: 'highestRiskLevel', label: 'Highest Risk Level' },
    { key: 'highestRiskScore', label: 'Highest Risk Score' },
    { key: 'latestHighRiskAlertAt', label: 'Latest High-Risk Alert At' },
    { key: 'invalidReviewId', label: 'Invalid Review ID' },
    { key: 'invalidStatus', label: 'Invalid Status' },
    { key: 'invalidReviewStatus', label: 'Invalid Review Status' },
    { key: 'reactivationStatus', label: 'Reactivation Status' },
    { key: 'correctedAuditEventHash', label: 'Corrected Audit Event Hash' },
    { key: 'correctedBlockchainTransactionId', label: 'Corrected Blockchain Transaction ID' },
    { key: 'invalidDetectedAt', label: 'Invalid Detected At' },
    { key: 'invalidResolvedAt', label: 'Invalid Resolved At' },
    { key: 'complianceRuleStatus', label: 'Compliance Rule Status' },
    { key: 'complianceRuleDecision', label: 'Compliance Rule Decision' },
    { key: 'complianceRuleScore', label: 'Compliance Rule Score' },
    { key: 'complianceRuleCodes', label: 'Compliance Rule Codes' },
    { key: 'complianceRuleEvaluatedAt', label: 'Compliance Rule Evaluated At' },
    { key: 'complianceRuleEvaluatedBy', label: 'Compliance Rule Evaluated By' },
    { key: 'changedByUser', label: 'Changed By User' },
    { key: 'changedByRole', label: 'Changed By Role' },
    { key: 'clientIp', label: 'Client IP' },
    { key: 'clientHostname', label: 'Client Hostname' },
    { key: 'sourceViewName', label: 'Source View Name' },
    { key: 'exportRedactionNote', label: 'Export Redaction Note' }
  ];
}

function mapExportRow(row, options = {}) {
  const mapped = mapAuditEventRow(row);
  const includeSensitiveRows = options.includeSensitiveRows === true;

  return {
    auditId: mapped.auditId,
    changedAt: mapped.changedAt,
    schemaName: mapped.schemaName,
    tableName: mapped.tableName,
    moduleName: mapped.moduleName,
    operationType: mapped.operationType,
    primaryKeyColumn: mapped.primaryKeyColumn,
    primaryKeyValue: mapped.primaryKeyValue,
    changedFields: mapped.changedFields,
    oldRowHash: mapped.oldRowHash,
    newRowHash: mapped.newRowHash,
    auditEventHash: mapped.auditEventHash,
    blockchainKey: mapped.blockchainKey,
    blockchainTransactionId: mapped.blockchainTransactionId,
    blockchainStatus: mapped.blockchainStatus,
    verificationStatus: mapped.verificationStatus,
    validationStatus: mapped.validationStatus,
    approvalStatus: mapped.approvalStatus,
    complianceStatus: mapped.complianceStatus,
    auditBatchId: mapped.auditBatchId,
    riskLevel: mapped.riskLevel,
    highRiskAlertStatus: mapped.highRiskAlertStatus,
    highRiskAlertCount: mapped.highRiskAlertCount,
    highestRiskLevel: mapped.highestRiskLevel,
    highestRiskScore: mapped.highestRiskScore,
    latestHighRiskAlertAt: mapped.latestHighRiskAlertAt,
    invalidReviewId: mapped.invalidReviewId,
    invalidStatus: mapped.invalidStatus,
    invalidReviewStatus: mapped.invalidReviewStatus,
    reactivationStatus: mapped.reactivationStatus,
    correctedAuditEventHash: mapped.correctedAuditEventHash,
    correctedBlockchainTransactionId: mapped.correctedBlockchainTransactionId,
    invalidDetectedAt: mapped.invalidDetectedAt,
    invalidResolvedAt: mapped.invalidResolvedAt,
    complianceRuleStatus: mapped.complianceRuleStatus,
    complianceRuleDecision: mapped.complianceRuleDecision,
    complianceRuleScore: mapped.complianceRuleScore,
    complianceRuleCodes: mapped.complianceRuleCodes,
    complianceRuleEvaluatedAt: mapped.complianceRuleEvaluatedAt,
    complianceRuleEvaluatedBy: mapped.complianceRuleEvaluatedBy,
    changedByUser: mapped.changedByUser,
    changedByRole: mapped.changedByRole,
    clientIp: mapped.clientIp,
    clientHostname: mapped.clientHostname,
    sourceViewName: mapped.sourceViewName,
    exportRedactionNote: includeSensitiveRows
      ? 'Privileged export. Raw old/new rows are still excluded from CSV evidence report.'
      : 'Raw old/new row values excluded. Hashes and metadata exported only.'
  };
}

async function getAuditExportReport(options = {}) {
  const filters = {
    tableName: options.tableName,
    moduleName: options.moduleName,
    operationType: options.operationType,
    user: options.user || options.changedByUser,
    clientIp: options.clientIp,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    blockchainStatus: options.blockchainStatus,
    verificationStatus: options.verificationStatus,
    approvalStatus: options.approvalStatus,
    batchId: options.batchId,
    role: options.role,
    clientHostname: options.clientHostname,
    riskLevel: options.riskLevel
  };

  const format = normalizeExportFormat(options.format);
  const limit = normalizeInteger(options.limit, 500, 1, 1000);
  const filter = buildFilterWhere(filters);
  const values = [...filter.values];
  const limitParam = values.push(limit);

  const result = await db.query(
    `
      SELECT
        a.audit_id,
        a.schema_name,
        a.table_name,
        a.module_name,
        a.primary_key_column,
        a.primary_key_value,
        a.operation_type,
        a.changed_fields,
        a.old_row_hash,
        a.new_row_hash,
        a.audit_event_hash,
        a.changed_by_app_user,
        a.changed_by_db_user,
        a.changed_by_role,
        a.client_ip,
        a.client_hostname,
        a.application_name,
        a.postgres_transaction_id,
        a.changed_at,
        a.blockchain_key,
        a.blockchain_transaction_id,
        a.blockchain_status,
        a.blockchain_submitted_at,
        a.blockchain_error,
        a.validation_status,
        ${VERIFICATION_STATUS_SQL} AS verification_status,
        a.approval_status,
        a.compliance_status,
        a.audit_batch_id,
        ${RISK_LEVEL_SQL} AS risk_level,
        a.high_risk_alert_status,
        a.high_risk_alert_count,
        a.highest_risk_level,
        a.highest_risk_score,
        a.latest_high_risk_alert_at,
        a.invalid_review_id,
        a.invalid_status,
        a.invalid_reason,
        a.invalid_review_status,
        a.reactivation_status,
        a.corrected_audit_event_hash,
        a.corrected_blockchain_key,
        a.corrected_blockchain_transaction_id,
        a.invalid_detected_at,
        a.invalid_resolved_at,
        a.compliance_rule_status,
        a.compliance_rule_decision,
        a.compliance_rule_score,
        a.compliance_rule_codes,
        a.compliance_rule_evaluated_at,
        a.compliance_rule_evaluated_by,
        a.source_view_name,
        a.created_at
      FROM blockchain.data_change_audit a
      ${filter.whereSql}
      ORDER BY a.changed_at DESC, a.audit_id DESC
      LIMIT $${limitParam}
    `,
    values
  );

  const headers = getExportHeaders();
  const rows = result.rows.map((row) => mapExportRow(row, {
    includeSensitiveRows: options.includeSensitiveRows === true
  }));

  const metadata = {
    reportName: 'Data Change Audit Evidence Report',
    generatedAt: new Date().toISOString(),
    sourceOfTruth: 'PostgreSQL',
    blockchainStorage: 'proof-only',
    piiPolicy: 'No sensitive values are stored on-chain. Export excludes raw old/new row payloads by default.',
    filters,
    rowCount: rows.length,
    limit
  };

  if (format === 'CSV') {
    return {
      format,
      fileName: buildExportFileName(format),
      contentType: 'text/csv; charset=utf-8',
      content: buildCsvContent(headers, rows),
      metadata
    };
  }

  return {
    format,
    fileName: buildExportFileName(format),
    contentType: 'application/json; charset=utf-8',
    content: JSON.stringify(
      {
        metadata,
        rows
      },
      null,
      2
    ),
    metadata
  };
}


module.exports = {
  DataChangeAuditDashboardError,
  roleAllowsSensitiveRows,
  getMetrics,
  listAuditEvents,
  getDashboard,
  getAuditEventDetail,
  getAuditExportReport,
  normalizeExportFormat
};
