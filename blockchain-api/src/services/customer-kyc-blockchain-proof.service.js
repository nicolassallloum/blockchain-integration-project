'use strict';

/**
 * Phase 14 — Customer KYC Blockchain Proof Service
 *
 * Rules:
 * - Proof input source is only blockchain.valoores_customer_kyc.
 * - Uses existing Phase 8 stable hash generator.
 * - Uses existing Phase 9 blockchain key generator.
 * - Uses existing Phase 10-12 generic proof submission lifecycle.
 * - Does not read raw AML business tables.
 */

const db = require('../config/database');
const stableHashGenerator = require('./stable-hash-generator.service');
const blockchainKeyGenerator = require('./blockchain-key-generator.service');
const blockchainApiProofService = require('./blockchain-api-proof.service');

const SOURCE_VIEW = 'blockchain.valoores_customer_kyc';
const MODULE_NAME = 'CUSTOMER_KYC';
const DEFAULT_ACTION_TYPE = 'SUBMIT';
const APPROVED_RECORD_STATUS = '79';
const APPROVED_RECORD_STATUS_NAME = 'Activated';
const SERVICE_NAME = 'phase-14-aml-rules-proof-service';

const REQUIRED_SOURCE_COLUMNS = Object.freeze([
  'source_system',
  'source_entity',
  'source_record_id',
  'business_reference',
  'record_status',
  'standardized_event_timestamp',
  'proof_version',
  'hash_input'
]);

class CustomerKycProofError extends Error {
  constructor(code, message, statusCode = 400, details = {}) {
    super(message);
    this.name = 'CustomerKycProofError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function normalizeText(value, fieldName) {
  if (value === null || value === undefined) {
    throw new CustomerKycProofError(
      `${fieldName.toUpperCase()}_REQUIRED`,
      `${fieldName} is required`,
      400
    );
  }

  const text = String(value).trim();

  if (!text) {
    throw new CustomerKycProofError(
      `${fieldName.toUpperCase()}_REQUIRED`,
      `${fieldName} is required`,
      400
    );
  }

  return text;
}

function normalizeSourceRecordId(sourceRecordId) {
  return normalizeText(sourceRecordId, 'sourceRecordId');
}

function mapSourceRow(row) {
  if (!row) {
    return null;
  }

  return {
    sourceSystem: row.source_system,
    sourceEntity: row.source_entity,
    sourceRecordId: row.source_record_id,
    businessReference: row.business_reference,
    recordType: row.record_type || row.event_type,
    recordStatus: row.record_status,
    standardizedEventTimestamp: row.standardized_event_timestamp,
    proofVersion: row.proof_version,
    hashInputLength: row.hash_input ? String(row.hash_input).length : 0,
    sourceView: SOURCE_VIEW
  };
}

function validateSourceRecord(row) {
  if (!row) {
    throw new CustomerKycProofError(
      'CUSTOMER_KYC_SOURCE_RECORD_NOT_FOUND',
      'Customer KYC source record was not found in blockchain.valoores_customer_kyc',
      404
    );
  }

  const missingColumns = REQUIRED_SOURCE_COLUMNS.filter((columnName) => {
    const value = row[columnName];
    return value === null || value === undefined || String(value).trim() === '';
  });

  const hasRecordOrEventType = Boolean(
    (row.record_type && String(row.record_type).trim()) ||
    (row.event_type && String(row.event_type).trim())
  );

  if (!hasRecordOrEventType) {
    missingColumns.push('record_type OR event_type');
  }

  if (missingColumns.length > 0) {
    throw new CustomerKycProofError(
      'CUSTOMER_KYC_SOURCE_RECORD_INVALID',
      'Customer KYC source record is missing required proof fields',
      422,
      {
        sourceView: SOURCE_VIEW,
        sourceRecordId: row.source_record_id || null,
        requiredRecordStatus: APPROVED_RECORD_STATUS,
        requiredRecordStatusName: APPROVED_RECORD_STATUS_NAME,
        missingColumns
      }
    );
  }

  if (String(row.source_entity).trim().toUpperCase() !== MODULE_NAME) {
    throw new CustomerKycProofError(
      'CUSTOMER_KYC_SOURCE_ENTITY_INVALID',
      `Customer KYC source_entity must be ${MODULE_NAME}`,
      422,
      {
        sourceEntity: row.source_entity
      }
    );
  }
}

async function getCustomerKycSourceRecord(sourceRecordId) {
  const normalizedSourceRecordId = normalizeSourceRecordId(sourceRecordId);

  const result = await db.query(
    `
      SELECT
        source_system,
        source_entity,
        source_record_id,
        business_reference,
        record_type,
        record_status,
        standardized_event_timestamp,
        proof_version,
        hash_input
      FROM blockchain.valoores_customer_kyc
      WHERE source_record_id = $1
        AND record_status = $2
      LIMIT 1
    `,
    [normalizedSourceRecordId, APPROVED_RECORD_STATUS]
  );

  const row = result.rows[0] || null;
  validateSourceRecord(row);

  return row;
}

function generateCustomerKycRecordHash(sourceRecord) {
  validateSourceRecord(sourceRecord);

  const hashResult = stableHashGenerator.generateRecordHash(
    {
      hash_input: String(sourceRecord.hash_input)
    },
    {
      includeDefaultExcludedFields: false,
      hashVersion: String(sourceRecord.proof_version || 'V1').trim().toUpperCase()
    }
  );

  return {
    recordHash: hashResult.recordHash,
    hashAlgorithm: 'SHA-256',
    hashVersion: String(sourceRecord.proof_version || 'V1').trim().toUpperCase(),
    canonicalJsonLength: hashResult.canonicalJson
      ? hashResult.canonicalJson.length
      : null
  };
}

function buildCustomerKycProofPayload(sourceRecord, options = {}) {
  validateSourceRecord(sourceRecord);

  const hashData = generateCustomerKycRecordHash(sourceRecord);

  const keyData = blockchainKeyGenerator.generateBlockchainKey({
    moduleName: sourceRecord.source_entity || MODULE_NAME,
    sourceRecordId: sourceRecord.source_record_id,
    hashVersion: sourceRecord.proof_version || 'V1'
  });

  return {
    sourceSystem: sourceRecord.source_system,
    blockchainKey: keyData.blockchainKey,
    moduleName: keyData.moduleName,
    sourceRecordId: keyData.sourceRecordId,
    recordHash: hashData.recordHash,
    hashVersion: keyData.hashVersion,
    actionType: options.actionType || DEFAULT_ACTION_TYPE,
    approvedBy: options.approvedBy || options.submittedBy || SERVICE_NAME
  };
}

async function previewCustomerKycProof(sourceRecordId, options = {}) {
  const sourceRecord = await getCustomerKycSourceRecord(sourceRecordId);
  const proofPayload = buildCustomerKycProofPayload(sourceRecord, options);

  return {
    sourceView: SOURCE_VIEW,
    source: mapSourceRow(sourceRecord),
    proof: {
      blockchainKey: proofPayload.blockchainKey,
      moduleName: proofPayload.moduleName,
      sourceRecordId: proofPayload.sourceRecordId,
      hashVersion: proofPayload.hashVersion,
      actionType: proofPayload.actionType,
      approvedBy: proofPayload.approvedBy,
      hasRecordHash: Boolean(proofPayload.recordHash),
      recordHashLength: proofPayload.recordHash
        ? String(proofPayload.recordHash).length
        : 0
    }
  };
}

async function submitCustomerKycProof(sourceRecordId, options = {}) {
  const sourceRecord = await getCustomerKycSourceRecord(sourceRecordId);
  const proofPayload = buildCustomerKycProofPayload(sourceRecord, options);

  const submission = await blockchainApiProofService.submitProof(
    proofPayload,
    {
      requestedBy: options.submittedBy || options.approvedBy || SERVICE_NAME,
      requestSource: 'POST /api/v1/government-blockchain/valoores-customer-kyc/proof/submit'
    }
  );

  return {
    sourceView: SOURCE_VIEW,
    source: mapSourceRow(sourceRecord),
    proof: {
      blockchainKey: proofPayload.blockchainKey,
      moduleName: proofPayload.moduleName,
      sourceRecordId: proofPayload.sourceRecordId,
      hashVersion: proofPayload.hashVersion,
      actionType: proofPayload.actionType,
      approvedBy: proofPayload.approvedBy,
      hasRecordHash: Boolean(proofPayload.recordHash),
      recordHashLength: proofPayload.recordHash
        ? String(proofPayload.recordHash).length
        : 0
    },
    submission
  };
}


function buildCustomerKycVerificationPayload(sourceRecord, options = {}) {
  const proofPayload = buildCustomerKycProofPayload(sourceRecord, options);

  return {
    blockchainKey: proofPayload.blockchainKey,
    recordHash: proofPayload.recordHash
  };
}

async function previewCustomerKycVerification(sourceRecordId, options = {}) {
  const sourceRecord = await getCustomerKycSourceRecord(sourceRecordId);
  const proofPayload = buildCustomerKycProofPayload(sourceRecord, options);
  const verificationPayload = buildCustomerKycVerificationPayload(sourceRecord, options);

  return {
    sourceView: SOURCE_VIEW,
    source: mapSourceRow(sourceRecord),
    proof: {
      blockchainKey: proofPayload.blockchainKey,
      moduleName: proofPayload.moduleName,
      sourceRecordId: proofPayload.sourceRecordId,
      hashVersion: proofPayload.hashVersion,
      actionType: proofPayload.actionType,
      hasRecordHash: Boolean(proofPayload.recordHash),
      recordHashLength: proofPayload.recordHash
        ? String(proofPayload.recordHash).length
        : 0
    },
    verificationPayload: {
      blockchainKey: verificationPayload.blockchainKey,
      hasRecordHash: Boolean(verificationPayload.recordHash),
      recordHashLength: verificationPayload.recordHash
        ? String(verificationPayload.recordHash).length
        : 0
    }
  };
}

async function verifyCustomerKycProof(sourceRecordId, options = {}) {
  const sourceRecord = await getCustomerKycSourceRecord(sourceRecordId);
  const proofPayload = buildCustomerKycProofPayload(sourceRecord, options);
  const verificationPayload = buildCustomerKycVerificationPayload(sourceRecord, options);

  const verification = await blockchainApiProofService.verifyProof(
    verificationPayload,
    {
      requestedBy: options.verifiedBy ||
        options.submittedBy ||
        options.approvedBy ||
        SERVICE_NAME,
      requestSource: 'POST /api/v1/government-blockchain/valoores-customer-kyc/proof/verify'
    }
  );

  return {
    sourceView: SOURCE_VIEW,
    source: mapSourceRow(sourceRecord),
    proof: {
      blockchainKey: proofPayload.blockchainKey,
      moduleName: proofPayload.moduleName,
      sourceRecordId: proofPayload.sourceRecordId,
      hashVersion: proofPayload.hashVersion,
      actionType: proofPayload.actionType,
      hasRecordHash: Boolean(proofPayload.recordHash),
      recordHashLength: proofPayload.recordHash
        ? String(proofPayload.recordHash).length
        : 0
    },
    verification
  };
}


function normalizeLimit(value, defaultLimit = 100, maxLimit = 500) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit;
  }

  return Math.min(parsed, maxLimit);
}

function normalizeOffset(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function mapStatusRow(row) {
  return {
    sourceView: SOURCE_VIEW,
    sourceSystem: row.source_system,
    sourceEntity: row.source_entity,
    sourceRecordId: row.source_record_id,
    businessReference: row.business_reference,
    recordType: row.record_type,
    recordStatus: row.record_status,
    standardizedEventTimestamp: row.standardized_event_timestamp,
    proofVersion: row.proof_version,
    expectedBlockchainKey: row.expected_blockchain_key,
    blockchainKey: row.blockchain_key || row.expected_blockchain_key,
    blockchainHistoryId: row.blockchain_history_id,
    blockchainStatus: row.effective_blockchain_status,
    verificationStatus: row.effective_verification_status,
    blockchainTransactionId: row.blockchain_transaction_id,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    verifiedAt: row.verified_at,
    retryCount: Number(row.retry_count || 0),
    hasBlockchainProof: Boolean(row.blockchain_history_id),
    hasBlockchainTransaction: Boolean(row.blockchain_transaction_id)
  };
}

async function getCustomerKycBlockchainStatus(options = {}) {
  const limit = normalizeLimit(options.limit, 100, 500);
  const offset = normalizeOffset(options.offset);
  const sourceRecordId = options.sourceRecordId
    ? normalizeSourceRecordId(options.sourceRecordId)
    : null;
  const search = options.search ? String(options.search).trim() : '';

  const values = [MODULE_NAME];
  const where = [];

  if (sourceRecordId) {
    values.push(sourceRecordId);
    where.push(`v.source_record_id = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    where.push(`(
      v.source_record_id ILIKE $${values.length}
      OR v.business_reference ILIKE $${values.length}
      OR v.record_status ILIKE $${values.length}
    )`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  values.push(limit);
  const limitParam = values.length;

  values.push(offset);
  const offsetParam = values.length;

  const result = await db.query(
    `
      WITH latest_history AS (
        SELECT DISTINCT ON (h.source_record_id)
          h.blockchain_history_id,
          h.module_name,
          h.source_record_id,
          h.blockchain_key,
          h.blockchain_status,
          h.blockchain_transaction_id,
          h.submitted_by,
          h.submitted_at,
          h.verified_at,
          h.verification_status,
          h.retry_count,
          h.updated_at
        FROM blockchain.blockchain_history h
        WHERE h.module_name = $1
        ORDER BY h.source_record_id, h.updated_at DESC, h.blockchain_history_id DESC
      ),
      joined AS (
        SELECT
          v.source_system,
          v.source_entity,
          v.source_record_id,
          v.business_reference,
          v.record_type,
          v.record_status,
          v.standardized_event_timestamp,
          v.proof_version,
          ('VALOORES:' || v.source_entity || ':' || v.source_record_id || ':' || v.proof_version) AS expected_blockchain_key,
          h.blockchain_history_id,
          h.blockchain_key,
          COALESCE(h.blockchain_status, 'NOT_SUBMITTED') AS effective_blockchain_status,
          COALESCE(h.verification_status, 'NOT_VERIFIED') AS effective_verification_status,
          h.blockchain_transaction_id,
          h.submitted_by,
          h.submitted_at,
          h.verified_at,
          h.retry_count
        FROM blockchain.valoores_customer_kyc v
        LEFT JOIN latest_history h
          ON h.source_record_id = v.source_record_id
        ${whereSql}
      ),
      totals AS (
        SELECT
          COUNT(*)::int AS total_records,
          COUNT(*) FILTER (WHERE blockchain_history_id IS NOT NULL)::int AS proof_records,
          COUNT(*) FILTER (WHERE blockchain_history_id IS NULL)::int AS not_submitted_records,
          COUNT(*) FILTER (WHERE effective_blockchain_status = 'SUBMITTED')::int AS submitted_records,
          COUNT(*) FILTER (WHERE effective_blockchain_status = 'FAILED')::int AS failed_records,
          COUNT(*) FILTER (WHERE effective_verification_status = 'VERIFIED')::int AS verified_records,
          COUNT(*) FILTER (WHERE effective_verification_status = 'MISMATCH')::int AS mismatch_records
        FROM joined
      )
      SELECT
        j.*,
        t.total_records,
        t.proof_records,
        t.not_submitted_records,
        t.submitted_records,
        t.failed_records,
        t.verified_records,
        t.mismatch_records
      FROM joined j
      CROSS JOIN totals t
      ORDER BY j.source_record_id
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `,
    values
  );

  const rows = result.rows;
  const first = rows[0] || {};

  return {
    sourceView: SOURCE_VIEW,
    moduleName: MODULE_NAME,
    limit,
    offset,
    summary: {
      totalRecords: Number(first.total_records || 0),
      proofRecords: Number(first.proof_records || 0),
      notSubmittedRecords: Number(first.not_submitted_records || 0),
      submittedRecords: Number(first.submitted_records || 0),
      failedRecords: Number(first.failed_records || 0),
      verifiedRecords: Number(first.verified_records || 0),
      mismatchRecords: Number(first.mismatch_records || 0)
    },
    records: rows.map(mapStatusRow)
  };
}

module.exports = {
  APPROVED_RECORD_STATUS,
  APPROVED_RECORD_STATUS_NAME,
  SOURCE_VIEW,
  MODULE_NAME,
  DEFAULT_ACTION_TYPE,
  SERVICE_NAME,
  CustomerKycProofError,
  getCustomerKycSourceRecord,
  generateCustomerKycRecordHash,
  buildCustomerKycProofPayload,
  buildCustomerKycVerificationPayload,
  previewCustomerKycProof,
  previewCustomerKycVerification,
  submitCustomerKycProof,
  verifyCustomerKycProof,
  getCustomerKycBlockchainStatus,
  getCustomerKycBlockchainStatus
};
