const db = require('../config/database');

const SERVICE_NAME = 'data-change-invalid-record-review-service';

const INVALID_STATUSES = new Set([
  'MISMATCH',
  'MISMATCHED',
  'TAMPERED',
  'NOT_FOUND',
  'FAILED',
  'NOT_VALID',
  'INVALID'
]);

const REVIEW_STATUSES = new Set([
  'UNDER_COMPLIANCE_REVIEW',
  'APPROVED_CORRECTED_VERSION',
  'REJECTED',
  'NEW_PROOF_SUBMITTED',
  'VERIFIED_ACTIVE',
  'CLOSED'
]);

class InvalidRecordReviewError extends Error {
  constructor(message, statusCode = 400, code = 'INVALID_RECORD_REVIEW_ERROR') {
    super(message);
    this.name = 'InvalidRecordReviewError';
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

  throw new InvalidRecordReviewError(
    'PostgreSQL client is not available.',
    500,
    'DB_CLIENT_NOT_AVAILABLE'
  );
}

function computedVerificationStatusSql(alias = 'a') {
  return `
    CASE
      WHEN UPPER(COALESCE(${alias}.validation_status, '')) IN ('INVALID', 'FAILED') THEN 'INVALID'
      WHEN UPPER(COALESCE(${alias}.blockchain_status, '')) IN ('MISMATCH', 'MISMATCHED') THEN 'MISMATCHED'
      WHEN ${alias}.blockchain_transaction_id IS NOT NULL THEN 'VERIFIED'
      WHEN UPPER(COALESCE(${alias}.blockchain_status, '')) IN ('SUBMITTED', 'CONFIRMED', 'BATCH_SUBMITTED') THEN 'VERIFIED'
      ELSE 'NOT_VERIFIED'
    END
  `;
}

function mapReviewRow(row) {
  return {
    reviewId: Number(row.review_id),
    reviewKey: row.review_key,
    auditId: Number(row.audit_id),
    invalidStatus: row.invalid_status,
    reviewStatus: row.review_status,
    reviewDecision: row.review_decision,
    reactivationStatus: row.reactivation_status,
    invalidReason: row.invalid_reason,
    detectedBy: row.detected_by,
    detectedAt: row.detected_at,
    originalValidationStatus: row.original_validation_status,
    originalBlockchainStatus: row.original_blockchain_status,
    originalComplianceStatus: row.original_compliance_status,
    originalApprovalStatus: row.original_approval_status,
    originalAuditEventHash: row.original_audit_event_hash,
    originalBlockchainKey: row.original_blockchain_key,
    originalBlockchainTransactionId: row.original_blockchain_transaction_id,
    originalBatchBlockchainTransactionId: row.original_batch_blockchain_transaction_id,
    correctedAuditEventHash: row.corrected_audit_event_hash,
    correctedBlockchainKey: row.corrected_blockchain_key,
    correctedBlockchainTransactionId: row.corrected_blockchain_transaction_id,
    correctionNotes: row.correction_notes,
    evidence: row.evidence,
    isCurrent: row.is_current,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    reactivatedBy: row.reactivated_by,
    reactivatedAt: row.reactivated_at,
    closedBy: row.closed_by,
    closedAt: row.closed_at,
    closureReason: row.closure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    audit: row.audit_id ? {
      schemaName: row.schema_name,
      tableName: row.table_name,
      moduleName: row.module_name,
      operationType: row.operation_type,
      primaryKeyValue: row.primary_key_value,
      changedAt: row.changed_at,
      currentValidationStatus: row.current_validation_status,
      currentBlockchainStatus: row.current_blockchain_status,
      currentComplianceStatus: row.current_compliance_status,
      currentApprovalStatus: row.current_approval_status,
      currentInvalidReviewStatus: row.current_invalid_review_status,
      currentReactivationStatus: row.current_reactivation_status
    } : undefined
  };
}

async function getSummary() {
  const result = await db.query(`
    SELECT *
    FROM blockchain.v_data_change_invalid_record_review_summary
  `);

  const row = result.rows[0] || {};

  return {
    totalReviews: Number(row.total_reviews || 0),
    underReview: Number(row.under_review || 0),
    approvedCorrectedVersions: Number(row.approved_corrected_versions || 0),
    newProofSubmitted: Number(row.new_proof_submitted || 0),
    verifiedActive: Number(row.verified_active || 0),
    rejected: Number(row.rejected || 0),
    reactivatedRecords: Number(row.reactivated_records || 0),
    latestReviewAt: row.latest_review_at,
    latestReactivatedAt: row.latest_reactivated_at
  };
}

async function getAuditEvent(auditId) {
  const normalizedAuditId = Number(auditId);

  if (!Number.isInteger(normalizedAuditId) || normalizedAuditId < 1) {
    throw new InvalidRecordReviewError('Valid auditId is required.', 400, 'INVALID_AUDIT_ID');
  }

  const result = await db.query(
    `
      SELECT
        a.*,
        ${computedVerificationStatusSql('a')} AS computed_verification_status
      FROM blockchain.data_change_audit a
      WHERE a.audit_id = $1
      LIMIT 1
    `,
    [normalizedAuditId]
  );

  if (!result.rows[0]) {
    throw new InvalidRecordReviewError(
      `Audit event not found: ${normalizedAuditId}`,
      404,
      'AUDIT_EVENT_NOT_FOUND'
    );
  }

  return result.rows[0];
}

async function listCandidates(options = {}) {
  const limit = toPositiveInt(options.limit, 50, 1, 500);
  const values = [];
  const conditions = [
    `(
      UPPER(COALESCE(a.validation_status, '')) IN ('INVALID', 'FAILED')
      OR UPPER(COALESCE(a.blockchain_status, '')) IN ('MISMATCH', 'MISMATCHED', 'TAMPERED', 'NOT_FOUND', 'FAILED', 'NOT_VALID')
      OR UPPER(COALESCE(a.batch_verification_status, '')) IN ('MISMATCH', 'TAMPERED', 'NOT_FOUND', 'FAILED')
      OR UPPER(COALESCE(a.compliance_status, '')) IN ('PENDING_REVIEW', 'UNDER_REVIEW', 'REVIEW')
      OR UPPER(COALESCE(a.high_risk_alert_status, '')) IN ('OPEN', 'PENDING_REVIEW', 'UNDER_REVIEW', 'ESCALATED')
    )`
  ];

  const status = normalizeUpper(options.status || options.reviewStatus);
  if (status && status !== 'ALL') {
    values.push(status);
    conditions.push(`UPPER(COALESCE(a.invalid_review_status, 'NO_REVIEW')) = $${values.length}`);
  }

  values.push(limit);

  const result = await db.query(
    `
      SELECT
        a.audit_id,
        a.schema_name,
        a.table_name,
        a.module_name,
        a.operation_type,
        a.primary_key_value,
        a.validation_status,
        ${computedVerificationStatusSql('a')} AS computed_verification_status,
        a.blockchain_status,
        a.batch_verification_status,
        a.compliance_status,
        a.approval_status,
        a.high_risk_alert_status,
        a.high_risk_alert_count,
        a.invalid_review_status,
        a.reactivation_status,
        a.audit_event_hash,
        a.blockchain_key,
        a.blockchain_transaction_id,
        a.batch_blockchain_transaction_id,
        a.changed_at
      FROM blockchain.data_change_audit a
      WHERE ${conditions.join(' AND ')}
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
    primaryKeyValue: row.primary_key_value,
    validationStatus: row.validation_status,
    computedVerificationStatus: row.computed_verification_status,
    blockchainStatus: row.blockchain_status,
    batchVerificationStatus: row.batch_verification_status,
    complianceStatus: row.compliance_status,
    approvalStatus: row.approval_status,
    highRiskAlertStatus: row.high_risk_alert_status,
    highRiskAlertCount: Number(row.high_risk_alert_count || 0),
    invalidReviewStatus: row.invalid_review_status,
    reactivationStatus: row.reactivation_status,
    auditEventHash: row.audit_event_hash,
    blockchainKey: row.blockchain_key,
    blockchainTransactionId: row.blockchain_transaction_id,
    batchBlockchainTransactionId: row.batch_blockchain_transaction_id,
    changedAt: row.changed_at
  }));
}

async function listReviews(options = {}) {
  const values = [];
  const conditions = [];
  const limit = toPositiveInt(options.limit, 50, 1, 500);
  const offset = toPositiveInt(options.offset, 0, 0, 1000000);

  const reviewStatus = normalizeUpper(options.reviewStatus || options.status);
  if (reviewStatus && reviewStatus !== 'ALL') {
    values.push(reviewStatus);
    conditions.push(`r.review_status = $${values.length}`);
  }

  const reactivationStatus = normalizeUpper(options.reactivationStatus);
  if (reactivationStatus && reactivationStatus !== 'ALL') {
    values.push(reactivationStatus);
    conditions.push(`r.reactivation_status = $${values.length}`);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  values.push(limit);
  const limitIndex = values.length;
  values.push(offset);
  const offsetIndex = values.length;

  const result = await db.query(
    `
      SELECT
        r.*,
        a.schema_name,
        a.table_name,
        a.module_name,
        a.operation_type,
        a.primary_key_value,
        a.changed_at,
        a.validation_status AS current_validation_status,
        a.blockchain_status AS current_blockchain_status,
        a.compliance_status AS current_compliance_status,
        a.approval_status AS current_approval_status,
        a.invalid_review_status AS current_invalid_review_status,
        a.reactivation_status AS current_reactivation_status
      FROM blockchain.data_change_invalid_record_reviews r
      JOIN blockchain.data_change_audit a
        ON a.audit_id = r.audit_id
      ${whereSql}
      ORDER BY r.created_at DESC, r.review_id DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `,
    values
  );

  const countResult = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM blockchain.data_change_invalid_record_reviews r
      ${whereSql}
    `,
    values.slice(0, values.length - 2)
  );

  return {
    rows: result.rows.map(mapReviewRow),
    pagination: {
      total: Number(countResult.rows[0]?.total || 0),
      limit,
      offset
    }
  };
}

async function getReview(reviewIdOrKey) {
  const key = normalizeText(reviewIdOrKey);

  if (!key) {
    throw new InvalidRecordReviewError('reviewIdOrKey is required.');
  }

  const result = await db.query(
    `
      SELECT
        r.*,
        a.schema_name,
        a.table_name,
        a.module_name,
        a.operation_type,
        a.primary_key_value,
        a.changed_at,
        a.validation_status AS current_validation_status,
        a.blockchain_status AS current_blockchain_status,
        a.compliance_status AS current_compliance_status,
        a.approval_status AS current_approval_status,
        a.invalid_review_status AS current_invalid_review_status,
        a.reactivation_status AS current_reactivation_status
      FROM blockchain.data_change_invalid_record_reviews r
      JOIN blockchain.data_change_audit a
        ON a.audit_id = r.audit_id
      WHERE r.review_id::text = $1
         OR r.review_key = $1
      LIMIT 1
    `,
    [key]
  );

  if (!result.rows[0]) {
    throw new InvalidRecordReviewError(
      `Invalid record review not found: ${key}`,
      404,
      'INVALID_RECORD_REVIEW_NOT_FOUND'
    );
  }

  return mapReviewRow(result.rows[0]);
}

async function logAction(client, input) {
  await client.query(
    `
      INSERT INTO blockchain.data_change_invalid_record_review_actions (
        review_id,
        audit_id,
        action_type,
        previous_review_status,
        new_review_status,
        previous_reactivation_status,
        new_reactivation_status,
        action_by,
        action_notes,
        action_metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
    `,
    [
      input.reviewId,
      input.auditId,
      input.actionType,
      input.previousReviewStatus || null,
      input.newReviewStatus || null,
      input.previousReactivationStatus || null,
      input.newReactivationStatus || null,
      input.actionBy || SERVICE_NAME,
      input.actionNotes || null,
      JSON.stringify(input.actionMetadata || {})
    ]
  );
}

async function openReview(options = {}) {
  const dryRun = options.dryRun === true || String(options.dryRun) === 'true';
  const audit = await getAuditEvent(options.auditId || options.audit_id);
  const invalidStatus = normalizeUpper(options.invalidStatus || options.invalid_status || 'NOT_VALID');

  if (!INVALID_STATUSES.has(invalidStatus)) {
    throw new InvalidRecordReviewError('Valid invalidStatus is required.');
  }

  const actor = normalizeText(options.detectedBy || options.user || options.createdBy, SERVICE_NAME);
  const reason = normalizeText(options.reason || options.invalidReason, 'Invalid audit record requires compliance review.');
  const reviewKey = `INVALID_REVIEW:${audit.audit_id}:${Date.now()}`;

  if (dryRun) {
    return {
      created: false,
      dryRun: true,
      action: 'OPEN_REVIEW',
      auditId: Number(audit.audit_id),
      invalidStatus,
      reviewStatus: 'UNDER_COMPLIANCE_REVIEW',
      reactivationStatus: 'NOT_REACTIVATED',
      reason
    };
  }

  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `
        SELECT *
        FROM blockchain.data_change_invalid_record_reviews
        WHERE audit_id = $1
          AND is_current = true
        LIMIT 1
      `,
      [audit.audit_id]
    );

    if (existing.rows[0]) {
      await client.query('COMMIT');
      return {
        created: false,
        existing: true,
        review: mapReviewRow(existing.rows[0])
      };
    }

    const insertResult = await client.query(
      `
        INSERT INTO blockchain.data_change_invalid_record_reviews (
          review_key,
          audit_id,
          invalid_status,
          review_status,
          review_decision,
          reactivation_status,
          invalid_reason,
          detected_by,
          original_validation_status,
          original_blockchain_status,
          original_compliance_status,
          original_approval_status,
          original_audit_event_hash,
          original_blockchain_key,
          original_blockchain_transaction_id,
          original_batch_blockchain_transaction_id,
          evidence
        )
        VALUES (
          $1,$2,$3,'UNDER_COMPLIANCE_REVIEW','PENDING','NOT_REACTIVATED',$4,$5,
          $6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb
        )
        RETURNING *
      `,
      [
        reviewKey,
        audit.audit_id,
        invalidStatus,
        reason,
        actor,
        audit.validation_status,
        audit.blockchain_status,
        audit.compliance_status,
        audit.approval_status,
        audit.audit_event_hash,
        audit.blockchain_key,
        audit.blockchain_transaction_id,
        audit.batch_blockchain_transaction_id,
        JSON.stringify({
          computedVerificationStatus: audit.computed_verification_status,
          batchVerificationStatus: audit.batch_verification_status,
          highRiskAlertStatus: audit.high_risk_alert_status,
          highRiskAlertCount: audit.high_risk_alert_count,
          proofOnlyBlockchain: true
        })
      ]
    );

    const review = insertResult.rows[0];

    await client.query(
      `
        UPDATE blockchain.data_change_audit
        SET
          invalid_review_id = $2,
          invalid_status = $3,
          invalid_reason = $4,
          invalid_review_status = 'UNDER_COMPLIANCE_REVIEW',
          reactivation_status = 'NOT_REACTIVATED',
          invalid_detected_at = now(),
          validation_status = 'INVALID',
          blockchain_status = CASE
            WHEN $3 IN ('MISMATCH', 'MISMATCHED', 'TAMPERED', 'NOT_FOUND', 'FAILED', 'NOT_VALID') THEN $3
            ELSE blockchain_status
          END,
          compliance_status = 'UNDER_REVIEW',
          approval_status = 'MANUAL_REQUIRED'
        WHERE audit_id = $1
      `,
      [audit.audit_id, review.review_id, invalidStatus, reason]
    );

    await logAction(client, {
      reviewId: review.review_id,
      auditId: audit.audit_id,
      actionType: 'OPEN_REVIEW',
      previousReviewStatus: 'NO_REVIEW',
      newReviewStatus: 'UNDER_COMPLIANCE_REVIEW',
      previousReactivationStatus: 'NOT_REACTIVATED',
      newReactivationStatus: 'NOT_REACTIVATED',
      actionBy: actor,
      actionNotes: reason
    });

    await client.query('COMMIT');

    return {
      created: true,
      dryRun: false,
      review: mapReviewRow(review)
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (typeof client.release === 'function') client.release();
  }
}

async function approveCorrectedVersion(reviewIdOrKey, options = {}) {
  const dryRun = options.dryRun === true || String(options.dryRun) === 'true';
  const current = await getReview(reviewIdOrKey);
  const actor = normalizeText(options.approvedBy || options.user, SERVICE_NAME);
  const correctedHash = normalizeText(options.correctedAuditEventHash || options.corrected_audit_event_hash);
  const notes = normalizeText(options.notes || options.correctionNotes, 'Corrected version approved by compliance.');

  if (dryRun) {
    return {
      updated: false,
      dryRun: true,
      action: 'APPROVE_CORRECTED_VERSION',
      reviewId: current.reviewId,
      auditId: current.auditId,
      nextReviewStatus: 'APPROVED_CORRECTED_VERSION',
      nextReactivationStatus: 'APPROVED_CORRECTION',
      correctedAuditEventHash: correctedHash || null
    };
  }

  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE blockchain.data_change_invalid_record_reviews
        SET
          review_status = 'APPROVED_CORRECTED_VERSION',
          review_decision = 'APPROVED_CORRECTED_VERSION',
          reactivation_status = 'APPROVED_CORRECTION',
          corrected_audit_event_hash = COALESCE(NULLIF($2, ''), corrected_audit_event_hash),
          correction_notes = $3,
          approved_by = $4,
          approved_at = now(),
          reviewed_by = COALESCE(reviewed_by, $4),
          reviewed_at = COALESCE(reviewed_at, now()),
          review_notes = COALESCE(review_notes, $3),
          updated_at = now()
        WHERE review_id = $1
        RETURNING *
      `,
      [current.reviewId, correctedHash, notes, actor]
    );

    await client.query(
      `
        UPDATE blockchain.data_change_audit
        SET
          invalid_review_status = 'APPROVED_CORRECTED_VERSION',
          reactivation_status = 'APPROVED_CORRECTION',
          corrected_audit_event_hash = COALESCE(NULLIF($2, ''), corrected_audit_event_hash),
          compliance_status = 'CORRECTION_APPROVED',
          approval_status = 'APPROVED_CORRECTED_VERSION'
        WHERE audit_id = $1
      `,
      [current.auditId, correctedHash]
    );

    await logAction(client, {
      reviewId: current.reviewId,
      auditId: current.auditId,
      actionType: 'APPROVE_CORRECTED_VERSION',
      previousReviewStatus: current.reviewStatus,
      newReviewStatus: 'APPROVED_CORRECTED_VERSION',
      previousReactivationStatus: current.reactivationStatus,
      newReactivationStatus: 'APPROVED_CORRECTION',
      actionBy: actor,
      actionNotes: notes
    });

    await client.query('COMMIT');

    return {
      updated: true,
      dryRun: false,
      review: mapReviewRow(result.rows[0])
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (typeof client.release === 'function') client.release();
  }
}

async function markNewProofSubmitted(reviewIdOrKey, options = {}) {
  const dryRun = options.dryRun === true || String(options.dryRun) === 'true';
  const current = await getReview(reviewIdOrKey);
  const actor = normalizeText(options.submittedBy || options.user, SERVICE_NAME);
  const correctedHash = normalizeText(options.correctedAuditEventHash || options.corrected_audit_event_hash || current.correctedAuditEventHash);
  const blockchainKey = normalizeText(options.correctedBlockchainKey || options.blockchainKey || current.correctedBlockchainKey);
  const transactionId = normalizeText(options.correctedBlockchainTransactionId || options.transactionId || options.blockchainTransactionId);
  const notes = normalizeText(options.notes, 'Corrected proof submitted for invalid record review.');

  if (!dryRun && !transactionId) {
    throw new InvalidRecordReviewError('transactionId is required to mark new proof as submitted.');
  }

  if (dryRun) {
    return {
      updated: false,
      dryRun: true,
      action: 'MARK_NEW_PROOF_SUBMITTED',
      reviewId: current.reviewId,
      auditId: current.auditId,
      nextReviewStatus: 'NEW_PROOF_SUBMITTED',
      nextReactivationStatus: 'NEW_PROOF_SUBMITTED',
      correctedAuditEventHash: correctedHash || null,
      correctedBlockchainKey: blockchainKey || null,
      correctedBlockchainTransactionId: transactionId || null
    };
  }

  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE blockchain.data_change_invalid_record_reviews
        SET
          review_status = 'NEW_PROOF_SUBMITTED',
          reactivation_status = 'NEW_PROOF_SUBMITTED',
          corrected_audit_event_hash = COALESCE(NULLIF($2, ''), corrected_audit_event_hash),
          corrected_blockchain_key = COALESCE(NULLIF($3, ''), corrected_blockchain_key),
          corrected_blockchain_transaction_id = $4,
          submitted_by = $5,
          submitted_at = now(),
          correction_notes = COALESCE(correction_notes, $6),
          updated_at = now()
        WHERE review_id = $1
        RETURNING *
      `,
      [current.reviewId, correctedHash, blockchainKey, transactionId, actor, notes]
    );

    await client.query(
      `
        UPDATE blockchain.data_change_audit
        SET
          invalid_review_status = 'NEW_PROOF_SUBMITTED',
          reactivation_status = 'NEW_PROOF_SUBMITTED',
          corrected_audit_event_hash = COALESCE(NULLIF($2, ''), corrected_audit_event_hash),
          corrected_blockchain_key = COALESCE(NULLIF($3, ''), corrected_blockchain_key),
          corrected_blockchain_transaction_id = $4,
          blockchain_transaction_id = $4,
          blockchain_key = COALESCE(NULLIF($3, ''), blockchain_key),
          blockchain_status = 'SUBMITTED',
          blockchain_submitted_at = now(),
          validation_status = 'VALIDATED',
          compliance_status = 'NEW_PROOF_SUBMITTED',
          approval_status = 'APPROVED_CORRECTED_VERSION'
        WHERE audit_id = $1
      `,
      [current.auditId, correctedHash, blockchainKey, transactionId]
    );

    await logAction(client, {
      reviewId: current.reviewId,
      auditId: current.auditId,
      actionType: 'MARK_NEW_PROOF_SUBMITTED',
      previousReviewStatus: current.reviewStatus,
      newReviewStatus: 'NEW_PROOF_SUBMITTED',
      previousReactivationStatus: current.reactivationStatus,
      newReactivationStatus: 'NEW_PROOF_SUBMITTED',
      actionBy: actor,
      actionNotes: notes,
      actionMetadata: { transactionId, blockchainKey, correctedHash }
    });

    await client.query('COMMIT');

    return {
      updated: true,
      dryRun: false,
      review: mapReviewRow(result.rows[0])
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (typeof client.release === 'function') client.release();
  }
}

async function reactivateRecord(reviewIdOrKey, options = {}) {
  const dryRun = options.dryRun === true || String(options.dryRun) === 'true';
  const current = await getReview(reviewIdOrKey);
  const actor = normalizeText(options.reactivatedBy || options.user, SERVICE_NAME);
  const notes = normalizeText(options.notes, 'Invalid record reactivated after corrected proof submission.');

  if (!dryRun && current.reviewStatus !== 'NEW_PROOF_SUBMITTED') {
    throw new InvalidRecordReviewError(
      'Record can be reactivated only after NEW_PROOF_SUBMITTED.',
      409,
      'NEW_PROOF_REQUIRED_BEFORE_REACTIVATION'
    );
  }

  if (dryRun) {
    return {
      updated: false,
      dryRun: true,
      action: 'REACTIVATE_RECORD',
      reviewId: current.reviewId,
      auditId: current.auditId,
      requiredCurrentStatus: 'NEW_PROOF_SUBMITTED',
      nextReviewStatus: 'VERIFIED_ACTIVE',
      nextReactivationStatus: 'REACTIVATED'
    };
  }

  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE blockchain.data_change_invalid_record_reviews
        SET
          review_status = 'VERIFIED_ACTIVE',
          review_decision = 'REACTIVATED',
          reactivation_status = 'REACTIVATED',
          reactivated_by = $2,
          reactivated_at = now(),
          closed_by = $2,
          closed_at = now(),
          closure_reason = $3,
          is_current = false,
          updated_at = now()
        WHERE review_id = $1
        RETURNING *
      `,
      [current.reviewId, actor, notes]
    );

    await client.query(
      `
        UPDATE blockchain.data_change_audit
        SET
          invalid_review_status = 'VERIFIED_ACTIVE',
          reactivation_status = 'REACTIVATED',
          validation_status = 'VALIDATED',
          compliance_status = 'VERIFIED_ACTIVE',
          approval_status = 'REACTIVATED',
          blockchain_status = 'SUBMITTED',
          invalid_resolved_at = now()
        WHERE audit_id = $1
      `,
      [current.auditId]
    );

    await logAction(client, {
      reviewId: current.reviewId,
      auditId: current.auditId,
      actionType: 'REACTIVATE_RECORD',
      previousReviewStatus: current.reviewStatus,
      newReviewStatus: 'VERIFIED_ACTIVE',
      previousReactivationStatus: current.reactivationStatus,
      newReactivationStatus: 'REACTIVATED',
      actionBy: actor,
      actionNotes: notes
    });

    await client.query('COMMIT');

    return {
      updated: true,
      dryRun: false,
      review: mapReviewRow(result.rows[0])
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (typeof client.release === 'function') client.release();
  }
}

async function rejectReactivation(reviewIdOrKey, options = {}) {
  const dryRun = options.dryRun === true || String(options.dryRun) === 'true';
  const current = await getReview(reviewIdOrKey);
  const actor = normalizeText(options.rejectedBy || options.user, SERVICE_NAME);
  const notes = normalizeText(options.notes || options.reason, 'Invalid record reactivation rejected by compliance.');

  if (dryRun) {
    return {
      updated: false,
      dryRun: true,
      action: 'REJECT_REACTIVATION',
      reviewId: current.reviewId,
      auditId: current.auditId,
      nextReviewStatus: 'REJECTED',
      nextReactivationStatus: 'REJECTED'
    };
  }

  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE blockchain.data_change_invalid_record_reviews
        SET
          review_status = 'REJECTED',
          review_decision = 'REJECTED',
          reactivation_status = 'REJECTED',
          reviewed_by = $2,
          reviewed_at = now(),
          review_notes = $3,
          updated_at = now()
        WHERE review_id = $1
        RETURNING *
      `,
      [current.reviewId, actor, notes]
    );

    await client.query(
      `
        UPDATE blockchain.data_change_audit
        SET
          invalid_review_status = 'REJECTED',
          reactivation_status = 'REJECTED',
          compliance_status = 'REJECTED',
          approval_status = 'REJECTED'
        WHERE audit_id = $1
      `,
      [current.auditId]
    );

    await logAction(client, {
      reviewId: current.reviewId,
      auditId: current.auditId,
      actionType: 'REJECT_REACTIVATION',
      previousReviewStatus: current.reviewStatus,
      newReviewStatus: 'REJECTED',
      previousReactivationStatus: current.reactivationStatus,
      newReactivationStatus: 'REJECTED',
      actionBy: actor,
      actionNotes: notes
    });

    await client.query('COMMIT');

    return {
      updated: true,
      dryRun: false,
      review: mapReviewRow(result.rows[0])
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (typeof client.release === 'function') client.release();
  }
}

async function closeReview(reviewIdOrKey, options = {}) {
  const dryRun = options.dryRun === true || String(options.dryRun) === 'true';
  const current = await getReview(reviewIdOrKey);
  const actor = normalizeText(options.closedBy || options.user, SERVICE_NAME);
  const notes = normalizeText(options.notes || options.closureReason, 'Invalid record review closed.');

  if (dryRun) {
    return {
      updated: false,
      dryRun: true,
      action: 'CLOSE_REVIEW',
      reviewId: current.reviewId,
      auditId: current.auditId,
      nextReviewStatus: 'CLOSED'
    };
  }

  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE blockchain.data_change_invalid_record_reviews
        SET
          review_status = 'CLOSED',
          review_decision = 'CLOSED',
          closed_by = $2,
          closed_at = now(),
          closure_reason = $3,
          is_current = false,
          updated_at = now()
        WHERE review_id = $1
        RETURNING *
      `,
      [current.reviewId, actor, notes]
    );

    await client.query(
      `
        UPDATE blockchain.data_change_audit
        SET
          invalid_review_status = 'CLOSED',
          compliance_status = 'CLOSED',
          invalid_resolved_at = now()
        WHERE audit_id = $1
      `,
      [current.auditId]
    );

    await logAction(client, {
      reviewId: current.reviewId,
      auditId: current.auditId,
      actionType: 'CLOSE_REVIEW',
      previousReviewStatus: current.reviewStatus,
      newReviewStatus: 'CLOSED',
      previousReactivationStatus: current.reactivationStatus,
      newReactivationStatus: current.reactivationStatus,
      actionBy: actor,
      actionNotes: notes
    });

    await client.query('COMMIT');

    return {
      updated: true,
      dryRun: false,
      review: mapReviewRow(result.rows[0])
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
  InvalidRecordReviewError,
  getSummary,
  getAuditEvent,
  listCandidates,
  listReviews,
  getReview,
  openReview,
  approveCorrectedVersion,
  markNewProofSubmitted,
  reactivateRecord,
  rejectReactivation,
  closeReview
};
