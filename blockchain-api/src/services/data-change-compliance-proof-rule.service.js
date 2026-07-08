const db = require('../config/database');

const SERVICE_NAME = 'data-change-compliance-proof-rule-service';

class ComplianceProofRuleError extends Error {
  constructor(message, statusCode = 400, code = 'COMPLIANCE_PROOF_RULE_ERROR') {
    super(message);
    this.name = 'ComplianceProofRuleError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function normalizeUpper(value, fallback = '') {
  return normalizeText(value, fallback).toUpperCase();
}

function toPositiveInt(value, fallback = 50, min = 1, max = 500) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

async function getDbClient() {
  if (typeof db.connect === 'function') return db.connect();
  if (typeof db.getClient === 'function') return db.getClient();
  if (db.pool && typeof db.pool.connect === 'function') return db.pool.connect();
  if (typeof db.getPool === 'function') return db.getPool().connect();

  throw new ComplianceProofRuleError(
    'PostgreSQL client is not available.',
    500,
    'DB_CLIENT_NOT_AVAILABLE'
  );
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return [value];
}

function rowTextContains(row, columnName, patterns) {
  const source = normalizeText(row[columnName]).toLowerCase();
  return asArray(patterns).some((pattern) => source.includes(normalizeText(pattern).toLowerCase()));
}

function rowUpperIn(row, columnName, values) {
  const allowed = asArray(values).map((value) => normalizeUpper(value));
  if (!allowed.length) return true;
  return allowed.includes(normalizeUpper(row[columnName]));
}

function changedFieldsContain(row, patterns) {
  const text = JSON.stringify(row.changed_fields || {}).toLowerCase();
  return asArray(patterns).some((pattern) => text.includes(normalizeText(pattern).toLowerCase()));
}

function hasExcludedPattern(row, condition = {}) {
  if (condition.excludeTableNameContains && rowTextContains(row, 'table_name', condition.excludeTableNameContains)) {
    return true;
  }

  if (condition.excludeModuleNameContains && rowTextContains(row, 'module_name', condition.excludeModuleNameContains)) {
    return true;
  }

  if (condition.excludeSourceViewNameContains && rowTextContains(row, 'source_view_name', condition.excludeSourceViewNameContains)) {
    return true;
  }

  if (condition.excludeChangedFieldsContain && changedFieldsContain(row, condition.excludeChangedFieldsContain)) {
    return true;
  }

  return false;
}

function evaluateCondition(row, condition = {}) {
  if (hasExcludedPattern(row, condition)) {
    return false;
  }

  const checks = [];

  if (condition.operationTypes) {
    checks.push(rowUpperIn(row, 'operation_type', condition.operationTypes));
  }

  if (condition.blockchainStatuses) {
    checks.push(rowUpperIn(row, 'blockchain_status', condition.blockchainStatuses));
  }

  if (condition.batchVerificationStatuses) {
    const batchStatus = normalizeUpper(row.batch_verification_status);
    const values = asArray(condition.batchVerificationStatuses).map((value) => normalizeUpper(value));
    checks.push(values.includes(batchStatus));
  }

  if (condition.complianceStatuses) {
    checks.push(rowUpperIn(row, 'compliance_status', condition.complianceStatuses));
  }

  if (condition.approvalStatuses) {
    checks.push(rowUpperIn(row, 'approval_status', condition.approvalStatuses));
  }

  if (condition.highRiskAlertStatuses) {
    const values = asArray(condition.highRiskAlertStatuses).map((value) => normalizeUpper(value));
    checks.push(values.includes(normalizeUpper(row.high_risk_alert_status || 'NO_ALERT')));
  }

  if (condition.invalidReviewStatuses) {
    const values = asArray(condition.invalidReviewStatuses).map((value) => normalizeUpper(value));
    checks.push(values.includes(normalizeUpper(row.invalid_review_status || 'NO_REVIEW')));
  }

  if (condition.reactivationStatuses) {
    const values = asArray(condition.reactivationStatuses).map((value) => normalizeUpper(value));
    checks.push(values.includes(normalizeUpper(row.reactivation_status || 'NOT_REACTIVATED')));
  }

  if (condition.tableNameContains) {
    checks.push(rowTextContains(row, 'table_name', condition.tableNameContains));
  }

  if (condition.moduleNameContains) {
    checks.push(rowTextContains(row, 'module_name', condition.moduleNameContains));
  }

  if (condition.sourceViewNameContains) {
    checks.push(rowTextContains(row, 'source_view_name', condition.sourceViewNameContains));
  }

  if (condition.changedFieldsContain) {
    checks.push(changedFieldsContain(row, condition.changedFieldsContain));
  }

  if (condition.minHighRiskAlertCount !== undefined) {
    checks.push(Number(row.high_risk_alert_count || 0) >= Number(condition.minHighRiskAlertCount));
  }

  if (condition.minRiskScore !== undefined) {
    checks.push(Number(row.highest_risk_score || 0) >= Number(condition.minRiskScore));
  }

  if (condition.maxRiskScore !== undefined) {
    checks.push(Number(row.highest_risk_score || 0) <= Number(condition.maxRiskScore));
  }

  return checks.length === 0 ? false : checks.every(Boolean);
}

function mapRuleRow(row) {
  return {
    ruleId: Number(row.rule_id),
    ruleCode: row.rule_code,
    ruleName: row.rule_name,
    ruleDescription: row.rule_description,
    ruleCategory: row.rule_category,
    ruleScope: row.rule_scope,
    rulePriority: Number(row.rule_priority || 0),
    isActive: row.is_active,
    conditionJson: row.condition_json,
    decision: row.decision,
    riskLevel: row.risk_level,
    riskScore: Number(row.risk_score || 0),
    requiresManualReview: row.requires_manual_review,
    proofRequired: row.proof_required,
    autoApply: row.auto_apply,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at
  };
}

function mapEvaluationRow(row) {
  return {
    evaluationId: Number(row.evaluation_id),
    evaluationKey: row.evaluation_key,
    auditId: Number(row.audit_id),
    ruleId: row.rule_id === null || row.rule_id === undefined ? null : Number(row.rule_id),
    ruleCode: row.rule_code,
    ruleName: row.rule_name,
    ruleResult: row.rule_result,
    decision: row.decision,
    riskLevel: row.risk_level,
    riskScore: Number(row.risk_score || 0),
    evaluationReason: row.evaluation_reason,
    evidence: row.evidence,
    appliedToAudit: row.applied_to_audit,
    evaluatedBy: row.evaluated_by,
    evaluatedAt: row.evaluated_at,
    createdAt: row.created_at
  };
}

async function getSummary() {
  const result = await db.query(`
    SELECT *
    FROM blockchain.v_data_change_compliance_rule_summary
  `);

  const row = result.rows[0] || {};

  return {
    totalRules: Number(row.total_rules || 0),
    activeRules: Number(row.active_rules || 0),
    activeAutoApproveRules: Number(row.active_auto_approve_rules || 0),
    activeManualReviewRules: Number(row.active_manual_review_rules || 0),
    totalEvaluations: Number(row.total_evaluations || 0),
    evaluatedAuditEvents: Number(row.evaluated_audit_events || 0),
    manualReviewEvaluations: Number(row.manual_review_evaluations || 0),
    autoApproveEvaluations: Number(row.auto_approve_evaluations || 0),
    latestEvaluatedAt: row.latest_evaluated_at
  };
}

async function listRules(options = {}) {
  const values = [];
  const conditions = [];

  const activeOnly = options.activeOnly === true || String(options.activeOnly) === 'true';
  if (activeOnly) {
    conditions.push('is_active = true');
  }

  const category = normalizeUpper(options.category);
  if (category && category !== 'ALL') {
    values.push(category);
    conditions.push('UPPER(rule_category) = $' + values.length);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(
    `
      SELECT *
      FROM blockchain.data_change_compliance_rules
      ${whereSql}
      ORDER BY rule_priority ASC, rule_code ASC
    `,
    values
  );

  return result.rows.map(mapRuleRow);
}

async function getAuditEvent(auditId) {
  const normalizedAuditId = Number(auditId);

  if (!Number.isInteger(normalizedAuditId) || normalizedAuditId < 1) {
    throw new ComplianceProofRuleError('Valid auditId is required.', 400, 'INVALID_AUDIT_ID');
  }

  const result = await db.query(
    `
      SELECT *
      FROM blockchain.data_change_audit
      WHERE audit_id = $1
      LIMIT 1
    `,
    [normalizedAuditId]
  );

  if (!result.rows[0]) {
    throw new ComplianceProofRuleError(
      `Audit event not found: ${normalizedAuditId}`,
      404,
      'AUDIT_EVENT_NOT_FOUND'
    );
  }

  return result.rows[0];
}

function selectFinalDecision(matches) {
  if (!matches.length) {
    return {
      decision: 'NO_ACTION',
      riskLevel: 'LOW',
      riskScore: 0,
      requiresManualReview: false
    };
  }

  const maxRisk = Math.max(...matches.map((match) => Number(match.riskScore || 0)));
  const riskLevel =
    maxRisk >= 95 ? 'CRITICAL' :
    maxRisk >= 80 ? 'HIGH' :
    maxRisk >= 50 ? 'MEDIUM' :
    'LOW';

  if (matches.some((match) => match.decision === 'BLOCK')) {
    return { decision: 'BLOCK', riskLevel, riskScore: maxRisk, requiresManualReview: true };
  }

  if (matches.some((match) => match.decision === 'REJECT')) {
    return { decision: 'REJECT', riskLevel, riskScore: maxRisk, requiresManualReview: true };
  }

  if (matches.some((match) => match.decision === 'MANUAL_REVIEW')) {
    return { decision: 'MANUAL_REVIEW', riskLevel, riskScore: maxRisk, requiresManualReview: true };
  }

  if (matches.some((match) => match.decision === 'PROOF_REQUIRED')) {
    return { decision: 'PROOF_REQUIRED', riskLevel, riskScore: maxRisk, requiresManualReview: true };
  }

  if (matches.some((match) => match.decision === 'AUTO_APPROVE')) {
    return { decision: 'AUTO_APPROVE', riskLevel, riskScore: maxRisk, requiresManualReview: false };
  }

  return { decision: 'NO_ACTION', riskLevel, riskScore: maxRisk, requiresManualReview: false };
}

async function evaluateAuditEvent(auditId, options = {}) {
  const dryRun = options.dryRun === true || String(options.dryRun) === 'true';
  const evaluatedBy = normalizeText(options.evaluatedBy || options.user, SERVICE_NAME);
  const audit = await getAuditEvent(auditId);
  const rules = await listRules({ activeOnly: true });

  const matchedRules = rules
    .filter((rule) => evaluateCondition(audit, rule.conditionJson || {}))
    .map((rule) => ({
      ruleId: rule.ruleId,
      ruleCode: rule.ruleCode,
      ruleName: rule.ruleName,
      ruleCategory: rule.ruleCategory,
      decision: rule.decision,
      riskLevel: rule.riskLevel,
      riskScore: rule.riskScore,
      requiresManualReview: rule.requiresManualReview,
      proofRequired: rule.proofRequired,
      reason: rule.ruleDescription || rule.ruleName
    }));

  const finalDecision = selectFinalDecision(matchedRules);
  const matchedCodes = matchedRules.map((rule) => rule.ruleCode);

  if (dryRun) {
    return {
      evaluated: false,
      dryRun: true,
      auditId: Number(audit.audit_id),
      finalDecision,
      matchedRules,
      matchedRuleCodes: matchedCodes
    };
  }

  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    const matchedRuleCodesForCleanup = matchedCodes.length ? matchedCodes : ['__NO_MATCHED_RULES__'];

    await client.query(
      `
        DELETE FROM blockchain.data_change_compliance_rule_evaluations
        WHERE audit_id = $1
          AND NOT (rule_code = ANY($2::text[]))
      `,
      [audit.audit_id, matchedRuleCodesForCleanup]
    );

    const insertedEvaluations = [];

    for (const rule of matchedRules) {
      const evaluationKey = `COMPLIANCE_RULE:${audit.audit_id}:${rule.ruleCode}`;

      const result = await client.query(
        `
          INSERT INTO blockchain.data_change_compliance_rule_evaluations (
            evaluation_key,
            audit_id,
            rule_id,
            rule_code,
            rule_name,
            rule_result,
            decision,
            risk_level,
            risk_score,
            evaluation_reason,
            evidence,
            applied_to_audit,
            evaluated_by
          )
          VALUES (
            $1,$2,$3,$4,$5,'MATCHED',$6,$7,$8,$9,$10::jsonb,true,$11
          )
          ON CONFLICT (evaluation_key)
          DO UPDATE SET
            rule_result = EXCLUDED.rule_result,
            decision = EXCLUDED.decision,
            risk_level = EXCLUDED.risk_level,
            risk_score = EXCLUDED.risk_score,
            evaluation_reason = EXCLUDED.evaluation_reason,
            evidence = EXCLUDED.evidence,
            applied_to_audit = true,
            evaluated_by = EXCLUDED.evaluated_by,
            evaluated_at = now()
          RETURNING *
        `,
        [
          evaluationKey,
          audit.audit_id,
          rule.ruleId,
          rule.ruleCode,
          rule.ruleName,
          rule.decision,
          rule.riskLevel,
          rule.riskScore,
          rule.reason,
          JSON.stringify({
            proofOnlyBlockchain: true,
            sourceAuditEventHash: audit.audit_event_hash,
            blockchainKey: audit.blockchain_key,
            blockchainStatus: audit.blockchain_status,
            batchVerificationStatus: audit.batch_verification_status,
            highRiskAlertStatus: audit.high_risk_alert_status,
            highRiskAlertCount: audit.high_risk_alert_count,
            invalidReviewStatus: audit.invalid_review_status,
            reactivationStatus: audit.reactivation_status
          }),
          evaluatedBy
        ]
      );

      insertedEvaluations.push(result.rows[0]);
    }

    await client.query(
      `
        UPDATE blockchain.data_change_audit
        SET
          compliance_rule_status = 'EVALUATED',
          compliance_rule_decision = $2,
          compliance_rule_score = $3,
          compliance_rule_codes = $4::jsonb,
          compliance_rule_evaluated_at = now(),
          compliance_rule_evaluated_by = $5,
          compliance_status = CASE
            WHEN $2 = 'AUTO_APPROVE'
             AND COALESCE(high_risk_alert_count, 0) = 0
             AND COALESCE(invalid_review_status, 'NO_REVIEW') = 'NO_REVIEW'
              THEN 'AUTO_APPROVED'
            WHEN $2 IN ('MANUAL_REVIEW', 'PROOF_REQUIRED')
              THEN 'PENDING_REVIEW'
            WHEN $2 IN ('BLOCK', 'REJECT')
              THEN 'REJECTED'
            ELSE compliance_status
          END,
          approval_status = CASE
            WHEN $2 = 'AUTO_APPROVE'
             AND COALESCE(high_risk_alert_count, 0) = 0
             AND COALESCE(invalid_review_status, 'NO_REVIEW') = 'NO_REVIEW'
              THEN 'AUTO_APPROVED'
            WHEN $2 IN ('MANUAL_REVIEW', 'PROOF_REQUIRED')
              THEN 'MANUAL_REQUIRED'
            WHEN $2 IN ('BLOCK', 'REJECT')
              THEN 'REJECTED'
            ELSE approval_status
          END
        WHERE audit_id = $1
      `,
      [
        audit.audit_id,
        finalDecision.decision,
        finalDecision.riskScore,
        JSON.stringify(matchedCodes),
        evaluatedBy
      ]
    );

    await client.query('COMMIT');

    return {
      evaluated: true,
      dryRun: false,
      auditId: Number(audit.audit_id),
      finalDecision,
      matchedRules,
      matchedRuleCodes: matchedCodes,
      evaluations: insertedEvaluations.map(mapEvaluationRow)
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (typeof client.release === 'function') client.release();
  }
}

async function listCandidates(options = {}) {
  const limit = toPositiveInt(options.limit, 50, 1, 500);
  const values = [];
  const conditions = [];

  const onlyNotEvaluated = options.onlyNotEvaluated === true || String(options.onlyNotEvaluated) === 'true';
  if (onlyNotEvaluated) {
    conditions.push(`a.compliance_rule_status = 'NOT_EVALUATED'`);
  }

  const includePendingOnly = options.pendingOnly === true || String(options.pendingOnly) === 'true';
  if (includePendingOnly) {
    conditions.push(`a.approval_status IN ('PENDING', 'MANUAL_REQUIRED')`);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  values.push(limit);

  const result = await db.query(
    `
      SELECT
        a.audit_id,
        a.schema_name,
        a.table_name,
        a.module_name,
        a.operation_type,
        a.validation_status,
        a.blockchain_status,
        a.batch_verification_status,
        a.compliance_status,
        a.approval_status,
        a.high_risk_alert_status,
        a.high_risk_alert_count,
        a.highest_risk_level,
        a.highest_risk_score,
        a.invalid_review_status,
        a.invalid_status,
        a.reactivation_status,
        a.compliance_rule_status,
        a.compliance_rule_decision,
        a.compliance_rule_score,
        a.compliance_rule_codes,
        a.changed_at
      FROM blockchain.data_change_audit a
      ${whereSql}
      ORDER BY a.changed_at DESC, a.audit_id DESC
      LIMIT $${values.length}
    `,
    values
  );

  return result.rows.map((row) => ({
    auditId: Number(row.audit_id),
    schemaName: row.schema_name,
    tableName: row.table_name,
    moduleName: row.module_name,
    operationType: row.operation_type,
    validationStatus: row.validation_status,
    blockchainStatus: row.blockchain_status,
    batchVerificationStatus: row.batch_verification_status,
    complianceStatus: row.compliance_status,
    approvalStatus: row.approval_status,
    highRiskAlertStatus: row.high_risk_alert_status,
    highRiskAlertCount: Number(row.high_risk_alert_count || 0),
    highestRiskLevel: row.highest_risk_level,
    highestRiskScore: row.highest_risk_score === null || row.highest_risk_score === undefined ? null : Number(row.highest_risk_score),
    invalidReviewStatus: row.invalid_review_status,
    invalidStatus: row.invalid_status,
    reactivationStatus: row.reactivation_status,
    complianceRuleStatus: row.compliance_rule_status,
    complianceRuleDecision: row.compliance_rule_decision,
    complianceRuleScore: row.compliance_rule_score === null || row.compliance_rule_score === undefined ? null : Number(row.compliance_rule_score),
    complianceRuleCodes: row.compliance_rule_codes,
    changedAt: row.changed_at
  }));
}

async function scanAndEvaluate(options = {}) {
  const dryRun = options.dryRun === true || String(options.dryRun) === 'true';
  const candidates = await listCandidates({
    limit: options.limit || 25,
    onlyNotEvaluated: options.onlyNotEvaluated,
    pendingOnly: options.pendingOnly
  });

  const results = [];

  for (const candidate of candidates) {
    const result = await evaluateAuditEvent(candidate.auditId, {
      dryRun,
      evaluatedBy: options.evaluatedBy || options.user || SERVICE_NAME
    });

    results.push(result);
  }

  return {
    dryRun,
    scannedCount: candidates.length,
    evaluatedCount: results.length,
    results
  };
}

async function listEvaluations(options = {}) {
  const limit = toPositiveInt(options.limit, 50, 1, 500);
  const offset = toPositiveInt(options.offset, 0, 0, 1000000);
  const values = [];
  const conditions = [];

  const auditId = Number(options.auditId || options.audit_id);
  if (Number.isInteger(auditId) && auditId > 0) {
    values.push(auditId);
    conditions.push(`e.audit_id = $${values.length}`);
  }

  const decision = normalizeUpper(options.decision);
  if (decision && decision !== 'ALL') {
    values.push(decision);
    conditions.push(`e.decision = $${values.length}`);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  values.push(limit);
  const limitIndex = values.length;
  values.push(offset);
  const offsetIndex = values.length;

  const rowsResult = await db.query(
    `
      SELECT e.*
      FROM blockchain.data_change_compliance_rule_evaluations e
      ${whereSql}
      ORDER BY e.evaluated_at DESC, e.evaluation_id DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `,
    values
  );

  const countResult = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM blockchain.data_change_compliance_rule_evaluations e
      ${whereSql}
    `,
    values.slice(0, values.length - 2)
  );

  return {
    rows: rowsResult.rows.map(mapEvaluationRow),
    pagination: {
      total: Number(countResult.rows[0]?.total || 0),
      limit,
      offset
    }
  };
}

module.exports = {
  SERVICE_NAME,
  ComplianceProofRuleError,
  evaluateCondition,
  getSummary,
  listRules,
  listCandidates,
  evaluateAuditEvent,
  scanAndEvaluate,
  listEvaluations
};
