const crypto = require('crypto');
const db = require('../config/database');

const SERVICE_NAME = 'data-change-bulk-compliance-approval-service';

class BulkComplianceApprovalError extends Error {
  constructor(message, statusCode = 400, code = 'BULK_COMPLIANCE_APPROVAL_ERROR') {
    super(message);
    this.name = 'BulkComplianceApprovalError';
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

function toPositiveInt(value, fallback = 50, min = 1, max = 10000) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

async function getDbClient() {
  if (typeof db.connect === 'function') return db.connect();
  if (typeof db.getClient === 'function') return db.getClient();
  if (db.pool && typeof db.pool.connect === 'function') return db.pool.connect();
  if (typeof db.getPool === 'function') return db.getPool().connect();

  throw new BulkComplianceApprovalError(
    'PostgreSQL client is not available.',
    500,
    'DB_CLIENT_NOT_AVAILABLE'
  );
}

function makeBulkApprovalKey() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `BULK_APPROVAL_${stamp}_${suffix}`;
}

function mapBatchRow(row) {
  return {
    bulkApprovalId: Number(row.bulk_approval_id),
    bulkApprovalKey: row.bulk_approval_key,
    batchName: row.batch_name,
    batchDescription: row.batch_description,
    batchStatus: row.batch_status,
    batchDecision: row.batch_decision,
    approvalScope: row.approval_scope,
    selectionFilter: row.selection_filter,
    safetyPolicy: row.safety_policy,
    totalItemCount: Number(row.total_item_count || 0),
    pendingItemCount: Number(row.pending_item_count || 0),
    approvedItemCount: Number(row.approved_item_count || 0),
    rejectedItemCount: Number(row.rejected_item_count || 0),
    skippedItemCount: Number(row.skipped_item_count || 0),
    riskSummary: row.risk_summary,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectedBy: row.rejected_by,
    rejectedAt: row.rejected_at,
    closedBy: row.closed_by,
    closedAt: row.closed_at,
    reviewNotes: row.review_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapItemRow(row) {
  return {
    bulkApprovalItemId: Number(row.bulk_approval_item_id),
    bulkApprovalId: Number(row.bulk_approval_id),
    auditId: Number(row.audit_id),
    itemStatus: row.item_status,
    itemDecision: row.item_decision,
    previousApprovalStatus: row.previous_approval_status,
    previousComplianceStatus: row.previous_compliance_status,
    previousComplianceRuleStatus: row.previous_compliance_rule_status,
    previousComplianceRuleDecision: row.previous_compliance_rule_decision,
    previousHighRiskAlertStatus: row.previous_high_risk_alert_status,
    previousInvalidReviewStatus: row.previous_invalid_review_status,
    previousReactivationStatus: row.previous_reactivation_status,
    safetyResult: row.safety_result,
    safetyReasons: row.safety_reasons,
    appliedBy: row.applied_by,
    appliedAt: row.applied_at,
    itemNotes: row.item_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    audit: row.schema_name ? {
      schemaName: row.schema_name,
      tableName: row.table_name,
      moduleName: row.module_name,
      operationType: row.operation_type,
      validationStatus: row.validation_status,
      blockchainStatus: row.blockchain_status,
      complianceStatus: row.compliance_status,
      approvalStatus: row.approval_status,
      highRiskAlertStatus: row.high_risk_alert_status,
      highRiskAlertCount: Number(row.high_risk_alert_count || 0),
      invalidReviewStatus: row.invalid_review_status,
      reactivationStatus: row.reactivation_status,
      complianceRuleStatus: row.compliance_rule_status,
      complianceRuleDecision: row.compliance_rule_decision,
      complianceRuleScore: row.compliance_rule_score === null || row.compliance_rule_score === undefined ? null : Number(row.compliance_rule_score),
      changedAt: row.changed_at
    } : undefined
  };
}

async function getSummary() {
  const result = await db.query(`
    SELECT *
    FROM blockchain.v_data_change_bulk_approval_summary
  `);

  const row = result.rows[0] || {};

  return {
    totalBatches: Number(row.total_batches || 0),
    pendingBatches: Number(row.pending_batches || 0),
    approvedBatches: Number(row.approved_batches || 0),
    partiallyApprovedBatches: Number(row.partially_approved_batches || 0),
    rejectedBatches: Number(row.rejected_batches || 0),
    totalItems: Number(row.total_items || 0),
    pendingItems: Number(row.pending_items || 0),
    approvedItems: Number(row.approved_items || 0),
    rejectedItems: Number(row.rejected_items || 0),
    skippedItems: Number(row.skipped_items || 0),
    latestRequestedAt: row.latest_requested_at,
    latestApprovedAt: row.latest_approved_at
  };
}

function buildCandidateWhere(options = {}) {
  const values = [];
  const conditions = [
    `NOT EXISTS (
      SELECT 1
      FROM blockchain.data_change_bulk_approval_items bai
      JOIN blockchain.data_change_bulk_approval_batches bab
        ON bab.bulk_approval_id = bai.bulk_approval_id
      WHERE bai.audit_id = a.audit_id
        AND bab.batch_status IN ('PENDING_APPROVAL')
        AND bai.item_status = 'PENDING'
    )`
  ];

  const auditIds = Array.isArray(options.auditIds || options.audit_ids)
    ? (options.auditIds || options.audit_ids).map(Number).filter((id) => Number.isInteger(id) && id > 0)
    : [];

  if (auditIds.length) {
    values.push(auditIds);
    conditions.push(`a.audit_id = ANY($${values.length}::bigint[])`);
  } else {
    const includeManualRequired = options.includeManualRequired === true || String(options.includeManualRequired) === 'true';
    if (includeManualRequired) {
      conditions.push(`a.approval_status IN ('PENDING', 'BULK_PENDING', 'MANUAL_REQUIRED')`);
    } else {
      conditions.push(`a.approval_status IN ('PENDING', 'BULK_PENDING')`);
    }

    const allowHighRisk = options.allowHighRisk === true || String(options.allowHighRisk) === 'true';
    if (!allowHighRisk) {
      conditions.push(`COALESCE(a.high_risk_alert_count, 0) = 0`);
      conditions.push(`COALESCE(a.high_risk_alert_status, 'NO_ALERT') = 'NO_ALERT'`);
    }

    const allowInvalidReview = options.allowInvalidReview === true || String(options.allowInvalidReview) === 'true';
    if (!allowInvalidReview) {
      conditions.push(`COALESCE(a.invalid_review_status, 'NO_REVIEW') = 'NO_REVIEW'`);
      conditions.push(`COALESCE(a.reactivation_status, 'NOT_REACTIVATED') = 'NOT_REACTIVATED'`);
    }

    const excludeManualRuleDecision = options.excludeManualRuleDecision !== false && String(options.excludeManualRuleDecision) !== 'false';
    if (excludeManualRuleDecision) {
      conditions.push(`COALESCE(a.compliance_rule_decision, 'NO_DECISION') NOT IN ('MANUAL_REVIEW', 'PROOF_REQUIRED', 'BLOCK', 'REJECT')`);
    }
  }

  function addIlike(column, value) {
    const text = normalizeText(value);
    if (!text || text.toUpperCase() === 'ALL') return;
    values.push(`%${text}%`);
    conditions.push(`${column} ILIKE $${values.length}`);
  }

  function addEqual(column, value) {
    const text = normalizeUpper(value);
    if (!text || text === 'ALL') return;
    values.push(text);
    conditions.push(`UPPER(COALESCE(${column}, '')) = $${values.length}`);
  }

  addIlike('a.schema_name', options.schemaName || options.schema_name);
  addIlike('a.table_name', options.tableName || options.table_name);
  addIlike('a.module_name', options.moduleName || options.module_name);
  addEqual('a.operation_type', options.operationType || options.operation_type);
  addEqual('a.compliance_rule_decision', options.complianceRuleDecision || options.compliance_rule_decision);

  const dateFrom = normalizeText(options.dateFrom || options.date_from);
  if (dateFrom) {
    values.push(dateFrom);
    conditions.push(`a.changed_at >= $${values.length}::timestamptz`);
  }

  const dateTo = normalizeText(options.dateTo || options.date_to);
  if (dateTo) {
    values.push(dateTo);
    conditions.push(`a.changed_at < ($${values.length}::date + INTERVAL '1 day')`);
  }

  return {
    whereSql: `WHERE ${conditions.join(' AND ')}`,
    values
  };
}

async function listCandidates(options = {}) {
  const limit = toPositiveInt(options.limit, 100, 1, 10000);
  const filter = buildCandidateWhere(options);
  const values = [...filter.values];

  values.push(limit);
  const limitIndex = values.length;

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
        a.compliance_status,
        a.approval_status,
        a.high_risk_alert_status,
        a.high_risk_alert_count,
        a.invalid_review_status,
        a.reactivation_status,
        a.compliance_rule_status,
        a.compliance_rule_decision,
        a.compliance_rule_score,
        a.compliance_rule_codes,
        a.bulk_approval_status,
        a.changed_at
      FROM blockchain.data_change_audit a
      ${filter.whereSql}
      ORDER BY a.changed_at DESC, a.audit_id DESC
      LIMIT $${limitIndex}
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
    complianceStatus: row.compliance_status,
    approvalStatus: row.approval_status,
    highRiskAlertStatus: row.high_risk_alert_status,
    highRiskAlertCount: Number(row.high_risk_alert_count || 0),
    invalidReviewStatus: row.invalid_review_status,
    reactivationStatus: row.reactivation_status,
    complianceRuleStatus: row.compliance_rule_status,
    complianceRuleDecision: row.compliance_rule_decision,
    complianceRuleScore: row.compliance_rule_score === null || row.compliance_rule_score === undefined ? null : Number(row.compliance_rule_score),
    complianceRuleCodes: row.compliance_rule_codes,
    bulkApprovalStatus: row.bulk_approval_status,
    changedAt: row.changed_at
  }));
}

async function getBatch(batchIdOrKey) {
  const key = normalizeText(batchIdOrKey);

  if (!key) {
    throw new BulkComplianceApprovalError('bulkApprovalId or bulkApprovalKey is required.');
  }

  const result = await db.query(
    `
      SELECT *
      FROM blockchain.data_change_bulk_approval_batches
      WHERE bulk_approval_id::text = $1
         OR bulk_approval_key = $1
      LIMIT 1
    `,
    [key]
  );

  if (!result.rows[0]) {
    throw new BulkComplianceApprovalError(
      `Bulk approval batch not found: ${key}`,
      404,
      'BULK_APPROVAL_BATCH_NOT_FOUND'
    );
  }

  return mapBatchRow(result.rows[0]);
}

async function listBatches(options = {}) {
  const values = [];
  const conditions = [];
  const limit = toPositiveInt(options.limit, 50, 1, 500);
  const offset = toPositiveInt(options.offset, 0, 0, 1000000);

  const status = normalizeUpper(options.status || options.batchStatus);
  if (status && status !== 'ALL') {
    values.push(status);
    conditions.push(`batch_status = $${values.length}`);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  values.push(limit);
  const limitIndex = values.length;
  values.push(offset);
  const offsetIndex = values.length;

  const rowsResult = await db.query(
    `
      SELECT *
      FROM blockchain.data_change_bulk_approval_batches
      ${whereSql}
      ORDER BY requested_at DESC, bulk_approval_id DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `,
    values
  );

  const countResult = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM blockchain.data_change_bulk_approval_batches
      ${whereSql}
    `,
    values.slice(0, values.length - 2)
  );

  return {
    rows: rowsResult.rows.map(mapBatchRow),
    pagination: {
      total: Number(countResult.rows[0]?.total || 0),
      limit,
      offset
    }
  };
}

async function listBatchItems(batchIdOrKey, options = {}) {
  const batch = await getBatch(batchIdOrKey);
  const limit = toPositiveInt(options.limit, 100, 1, 10000);
  const offset = toPositiveInt(options.offset, 0, 0, 1000000);

  const result = await db.query(
    `
      SELECT
        i.*,
        a.schema_name,
        a.table_name,
        a.module_name,
        a.operation_type,
        a.validation_status,
        a.blockchain_status,
        a.compliance_status,
        a.approval_status,
        a.high_risk_alert_status,
        a.high_risk_alert_count,
        a.invalid_review_status,
        a.reactivation_status,
        a.compliance_rule_status,
        a.compliance_rule_decision,
        a.compliance_rule_score,
        a.changed_at
      FROM blockchain.data_change_bulk_approval_items i
      JOIN blockchain.data_change_audit a
        ON a.audit_id = i.audit_id
      WHERE i.bulk_approval_id = $1
      ORDER BY i.bulk_approval_item_id ASC
      LIMIT $2
      OFFSET $3
    `,
    [batch.bulkApprovalId, limit, offset]
  );

  return {
    batch,
    rows: result.rows.map(mapItemRow),
    pagination: {
      limit,
      offset
    }
  };
}

function buildRiskSummary(rows) {
  const summary = {
    total: rows.length,
    highRiskAlerts: 0,
    invalidReviews: 0,
    manualRuleDecisions: 0,
    autoApproveRuleDecisions: 0,
    notEvaluated: 0,
    byTable: {}
  };

  for (const row of rows) {
    if (Number(row.highRiskAlertCount || row.high_risk_alert_count || 0) > 0) summary.highRiskAlerts += 1;
    if (normalizeUpper(row.invalidReviewStatus || row.invalid_review_status || 'NO_REVIEW') !== 'NO_REVIEW') summary.invalidReviews += 1;
    if (['MANUAL_REVIEW', 'PROOF_REQUIRED', 'BLOCK', 'REJECT'].includes(normalizeUpper(row.complianceRuleDecision || row.compliance_rule_decision))) {
      summary.manualRuleDecisions += 1;
    }
    if (normalizeUpper(row.complianceRuleDecision || row.compliance_rule_decision) === 'AUTO_APPROVE') {
      summary.autoApproveRuleDecisions += 1;
    }
    if (normalizeUpper(row.complianceRuleStatus || row.compliance_rule_status || 'NOT_EVALUATED') !== 'EVALUATED') {
      summary.notEvaluated += 1;
    }

    const key = `${row.schemaName || row.schema_name}.${row.tableName || row.table_name}`;
    summary.byTable[key] = (summary.byTable[key] || 0) + 1;
  }

  return summary;
}

async function createBatch(options = {}) {
  const dryRun = options.dryRun === true || String(options.dryRun) === 'true';
  const requestedBy = normalizeText(options.requestedBy || options.user, SERVICE_NAME);
  const limit = toPositiveInt(options.limit, 100, 1, 10000);
  const candidates = await listCandidates({ ...options, limit });
  const batchName = normalizeText(options.batchName || options.name, `Bulk approval batch ${new Date().toISOString()}`);
  const batchDescription = normalizeText(options.batchDescription || options.description, 'Phase 37 bulk compliance approval batch.');
  const safetyPolicy = {
    allowHighRisk: options.allowHighRisk === true || String(options.allowHighRisk) === 'true',
    allowInvalidReview: options.allowInvalidReview === true || String(options.allowInvalidReview) === 'true',
    includeManualRequired: options.includeManualRequired === true || String(options.includeManualRequired) === 'true',
    requireEvaluatedAutoApproveForFinalApproval: true
  };
  const riskSummary = buildRiskSummary(candidates);

  if (dryRun) {
    return {
      created: false,
      dryRun: true,
      candidateCount: candidates.length,
      batchName,
      batchDescription,
      selectionFilter: options,
      safetyPolicy,
      riskSummary,
      candidates
    };
  }

  if (!candidates.length) {
    throw new BulkComplianceApprovalError('No eligible audit events found for bulk approval batch.', 404, 'NO_BULK_APPROVAL_CANDIDATES');
  }

  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    const batchResult = await client.query(
      `
        INSERT INTO blockchain.data_change_bulk_approval_batches (
          bulk_approval_key,
          batch_name,
          batch_description,
          batch_status,
          batch_decision,
          selection_filter,
          safety_policy,
          total_item_count,
          pending_item_count,
          risk_summary,
          requested_by
        )
        VALUES ($1,$2,$3,'PENDING_APPROVAL','PENDING',$4::jsonb,$5::jsonb,$6,$6,$7::jsonb,$8)
        RETURNING *
      `,
      [
        makeBulkApprovalKey(),
        batchName,
        batchDescription,
        JSON.stringify(options),
        JSON.stringify(safetyPolicy),
        candidates.length,
        JSON.stringify(riskSummary),
        requestedBy
      ]
    );

    const batch = batchResult.rows[0];

    for (const candidate of candidates) {
      await client.query(
        `
          INSERT INTO blockchain.data_change_bulk_approval_items (
            bulk_approval_id,
            audit_id,
            item_status,
            item_decision,
            previous_approval_status,
            previous_compliance_status,
            previous_compliance_rule_status,
            previous_compliance_rule_decision,
            previous_high_risk_alert_status,
            previous_invalid_review_status,
            previous_reactivation_status
          )
          VALUES ($1,$2,'PENDING','PENDING',$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (bulk_approval_id, audit_id)
          DO NOTHING
        `,
        [
          batch.bulk_approval_id,
          candidate.auditId,
          candidate.approvalStatus,
          candidate.complianceStatus,
          candidate.complianceRuleStatus,
          candidate.complianceRuleDecision,
          candidate.highRiskAlertStatus,
          candidate.invalidReviewStatus,
          candidate.reactivationStatus
        ]
      );

      await client.query(
        `
          UPDATE blockchain.data_change_audit
          SET
            bulk_approval_batch_id = $2,
            bulk_approval_status = 'PENDING_APPROVAL',
            bulk_approval_decision = 'PENDING',
            bulk_approval_requested_by = $3,
            bulk_approval_requested_at = now(),
            bulk_approval_notes = $4,
            approval_status = CASE
              WHEN approval_status = 'PENDING' THEN 'BULK_PENDING'
              ELSE approval_status
            END
          WHERE audit_id = $1
        `,
        [candidate.auditId, batch.bulk_approval_id, requestedBy, batchDescription]
      );
    }

    await client.query('COMMIT');

    return {
      created: true,
      dryRun: false,
      batch: mapBatchRow(batch),
      itemCount: candidates.length,
      riskSummary
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (typeof client.release === 'function') client.release();
  }
}

function evaluateItemSafety(row, options = {}) {
  const overrideSafety = options.overrideSafety === true || String(options.overrideSafety) === 'true';
  const requireEvaluatedAutoApprove =
    options.requireEvaluatedAutoApprove !== false &&
    String(options.requireEvaluatedAutoApprove) !== 'false';

  const reasons = [];

  if (!['PENDING', 'BULK_PENDING'].includes(normalizeUpper(row.approval_status))) {
    reasons.push(`Approval status is ${row.approval_status}`);
  }

  if (Number(row.high_risk_alert_count || 0) > 0 || normalizeUpper(row.high_risk_alert_status || 'NO_ALERT') !== 'NO_ALERT') {
    reasons.push('Active high-risk alert exists');
  }

  if (normalizeUpper(row.invalid_review_status || 'NO_REVIEW') !== 'NO_REVIEW') {
    reasons.push('Invalid-record review exists');
  }

  if (normalizeUpper(row.reactivation_status || 'NOT_REACTIVATED') !== 'NOT_REACTIVATED') {
    reasons.push('Record is in reactivation workflow');
  }

  if (['MANUAL_REVIEW', 'PROOF_REQUIRED', 'BLOCK', 'REJECT'].includes(normalizeUpper(row.compliance_rule_decision))) {
    reasons.push(`Compliance rule decision is ${row.compliance_rule_decision}`);
  }

  if (requireEvaluatedAutoApprove) {
    if (normalizeUpper(row.compliance_rule_status) !== 'EVALUATED') {
      reasons.push('Compliance rules were not evaluated');
    }

    if (normalizeUpper(row.compliance_rule_decision) !== 'AUTO_APPROVE') {
      reasons.push('Compliance rules did not produce AUTO_APPROVE');
    }
  }

  if (overrideSafety) {
    return {
      safe: true,
      safetyResult: reasons.length ? 'OVERRIDDEN' : 'SAFE',
      reasons
    };
  }

  return {
    safe: reasons.length === 0,
    safetyResult: reasons.length === 0 ? 'SAFE' : 'UNSAFE',
    reasons
  };
}

async function approveBatch(batchIdOrKey, options = {}) {
  const dryRun = options.dryRun === true || String(options.dryRun) === 'true';
  const actor = normalizeText(options.approvedBy || options.user, SERVICE_NAME);
  const batch = await getBatch(batchIdOrKey);
  const itemsResult = await listBatchItems(batch.bulkApprovalId, { limit: 10000 });
  const decisions = itemsResult.rows.map((item) => {
    const safety = evaluateItemSafety(item.audit || {}, options);

    return {
      bulkApprovalItemId: item.bulkApprovalItemId,
      auditId: item.auditId,
      approve: safety.safe,
      safetyResult: safety.safetyResult,
      safetyReasons: safety.reasons,
      previousApprovalStatus: item.previousApprovalStatus,
      previousComplianceStatus: item.previousComplianceStatus,
      previousComplianceRuleStatus: item.previousComplianceRuleStatus,
      previousComplianceRuleDecision: item.previousComplianceRuleDecision,
      previousHighRiskAlertStatus: item.previousHighRiskAlertStatus,
      previousInvalidReviewStatus: item.previousInvalidReviewStatus,
      previousReactivationStatus: item.previousReactivationStatus
    };
  });

  if (dryRun) {
    return {
      updated: false,
      dryRun: true,
      batch,
      decisions,
      wouldApprove: decisions.filter((item) => item.approve).length,
      wouldSkip: decisions.filter((item) => !item.approve).length
    };
  }

  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    let approvedCount = 0;
    let skippedCount = 0;

    for (const decision of decisions) {
      if (decision.approve) {
        approvedCount += 1;

        await client.query(
          `
            UPDATE blockchain.data_change_bulk_approval_items
            SET
              item_status = 'APPROVED',
              item_decision = 'APPROVED',
              safety_result = $3,
              safety_reasons = $4::jsonb,
              applied_by = $5,
              applied_at = now(),
              updated_at = now()
            WHERE bulk_approval_item_id = $1
              AND bulk_approval_id = $2
          `,
          [
            decision.bulkApprovalItemId,
            batch.bulkApprovalId,
            decision.safetyResult,
            JSON.stringify(decision.safetyReasons),
            actor
          ]
        );

        await client.query(
          `
            UPDATE blockchain.data_change_audit
            SET
              approval_status = 'BULK_APPROVED',
              compliance_status = 'BULK_APPROVED',
              bulk_approval_status = 'APPROVED',
              bulk_approval_decision = 'APPROVED',
              bulk_approval_applied_by = $2,
              bulk_approval_applied_at = now()
            WHERE audit_id = $1
          `,
          [decision.auditId, actor]
        );
      } else {
        skippedCount += 1;

        await client.query(
          `
            UPDATE blockchain.data_change_bulk_approval_items
            SET
              item_status = 'SKIPPED',
              item_decision = 'SKIPPED',
              safety_result = $3,
              safety_reasons = $4::jsonb,
              applied_by = $5,
              applied_at = now(),
              item_notes = 'Skipped by safety policy during bulk approval.',
              updated_at = now()
            WHERE bulk_approval_item_id = $1
              AND bulk_approval_id = $2
          `,
          [
            decision.bulkApprovalItemId,
            batch.bulkApprovalId,
            decision.safetyResult,
            JSON.stringify(decision.safetyReasons),
            actor
          ]
        );

        await client.query(
          `
            UPDATE blockchain.data_change_audit
            SET
              approval_status = COALESCE($2, approval_status),
              compliance_status = COALESCE($3, compliance_status),
              bulk_approval_status = 'SKIPPED',
              bulk_approval_decision = 'SKIPPED',
              bulk_approval_applied_by = $4,
              bulk_approval_applied_at = now(),
              bulk_approval_notes = $5
            WHERE audit_id = $1
          `,
          [
            decision.auditId,
            decision.previousApprovalStatus,
            decision.previousComplianceStatus,
            actor,
            'Skipped by safety policy during bulk approval.'
          ]
        );
      }
    }

    const finalStatus =
      approvedCount > 0 && skippedCount === 0 ? 'APPROVED' :
      approvedCount > 0 && skippedCount > 0 ? 'PARTIALLY_APPROVED' :
      'CLOSED';

    const finalDecision =
      approvedCount > 0 && skippedCount === 0 ? 'APPROVED' :
      approvedCount > 0 && skippedCount > 0 ? 'PARTIALLY_APPROVED' :
      'CLOSED';

    const batchResult = await client.query(
      `
        UPDATE blockchain.data_change_bulk_approval_batches
        SET
          batch_status = $2,
          batch_decision = $3,
          pending_item_count = 0,
          approved_item_count = $4,
          skipped_item_count = $5,
          reviewed_by = $6,
          reviewed_at = now(),
          approved_by = CASE WHEN $4 > 0 THEN $6 ELSE approved_by END,
          approved_at = CASE WHEN $4 > 0 THEN now() ELSE approved_at END,
          closed_by = $6,
          closed_at = now(),
          review_notes = $7,
          updated_at = now()
        WHERE bulk_approval_id = $1
        RETURNING *
      `,
      [
        batch.bulkApprovalId,
        finalStatus,
        finalDecision,
        approvedCount,
        skippedCount,
        actor,
        normalizeText(options.notes || options.reviewNotes, 'Phase 37 bulk approval processed.')
      ]
    );

    await client.query('COMMIT');

    return {
      updated: true,
      dryRun: false,
      batch: mapBatchRow(batchResult.rows[0]),
      decisions,
      approvedCount,
      skippedCount
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (typeof client.release === 'function') client.release();
  }
}

async function rejectBatch(batchIdOrKey, options = {}) {
  const dryRun = options.dryRun === true || String(options.dryRun) === 'true';
  const actor = normalizeText(options.rejectedBy || options.user, SERVICE_NAME);
  const reason = normalizeText(options.reason || options.notes, 'Phase 37 bulk approval batch rejected.');
  const batch = await getBatch(batchIdOrKey);
  const itemsResult = await listBatchItems(batch.bulkApprovalId, { limit: 10000 });

  if (dryRun) {
    return {
      updated: false,
      dryRun: true,
      batch,
      wouldReject: itemsResult.rows.length
    };
  }

  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    for (const item of itemsResult.rows) {
      await client.query(
        `
          UPDATE blockchain.data_change_bulk_approval_items
          SET
            item_status = 'REJECTED',
            item_decision = 'REJECTED',
            safety_result = 'NOT_CHECKED',
            applied_by = $3,
            applied_at = now(),
            item_notes = $4,
            updated_at = now()
          WHERE bulk_approval_id = $1
            AND audit_id = $2
        `,
        [batch.bulkApprovalId, item.auditId, actor, reason]
      );

      await client.query(
        `
          UPDATE blockchain.data_change_audit
          SET
            approval_status = COALESCE($2, approval_status),
            compliance_status = COALESCE($3, compliance_status),
            bulk_approval_status = 'REJECTED',
            bulk_approval_decision = 'REJECTED',
            bulk_approval_applied_by = $4,
            bulk_approval_applied_at = now(),
            bulk_approval_notes = $5
          WHERE audit_id = $1
        `,
        [
          item.auditId,
          item.previousApprovalStatus,
          item.previousComplianceStatus,
          actor,
          reason
        ]
      );
    }

    const batchResult = await client.query(
      `
        UPDATE blockchain.data_change_bulk_approval_batches
        SET
          batch_status = 'REJECTED',
          batch_decision = 'REJECTED',
          pending_item_count = 0,
          rejected_item_count = $2,
          reviewed_by = $3,
          reviewed_at = now(),
          rejected_by = $3,
          rejected_at = now(),
          closed_by = $3,
          closed_at = now(),
          review_notes = $4,
          updated_at = now()
        WHERE bulk_approval_id = $1
        RETURNING *
      `,
      [batch.bulkApprovalId, itemsResult.rows.length, actor, reason]
    );

    await client.query('COMMIT');

    return {
      updated: true,
      dryRun: false,
      batch: mapBatchRow(batchResult.rows[0]),
      rejectedCount: itemsResult.rows.length
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (typeof client.release === 'function') client.release();
  }
}

module.exports = {
  SERVICE_NAME,
  BulkComplianceApprovalError,
  getSummary,
  listCandidates,
  listBatches,
  getBatch,
  listBatchItems,
  createBatch,
  approveBatch,
  rejectBatch,
  evaluateItemSafety
};
