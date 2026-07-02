'use strict';

/**
 * Phase 13 — AML Rules Blockchain Proof Service
 *
 * Rules:
 * - Proof input source is only blockchain.valoores_aml_rules.
 * - Uses existing Phase 8 stable hash generator.
 * - Uses existing Phase 9 blockchain key generator.
 * - Uses existing Phase 10-12 generic proof submission lifecycle.
 * - Does not read raw AML business tables.
 */

const db = require('../config/database');
const stableHashGenerator = require('./stable-hash-generator.service');
const blockchainKeyGenerator = require('./blockchain-key-generator.service');
const blockchainApiProofService = require('./blockchain-api-proof.service');

const SOURCE_VIEW = 'blockchain.valoores_aml_rules';
const MODULE_NAME = 'AML_RULE';
const DEFAULT_ACTION_TYPE = 'SUBMIT';
const SERVICE_NAME = 'phase-13-aml-rules-proof-service';

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

class AmlRulesProofError extends Error {
  constructor(code, message, statusCode = 400, details = {}) {
    super(message);
    this.name = 'AmlRulesProofError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function normalizeText(value, fieldName) {
  if (value === null || value === undefined) {
    throw new AmlRulesProofError(
      `${fieldName.toUpperCase()}_REQUIRED`,
      `${fieldName} is required`,
      400
    );
  }

  const text = String(value).trim();

  if (!text) {
    throw new AmlRulesProofError(
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
    throw new AmlRulesProofError(
      'AML_RULE_SOURCE_RECORD_NOT_FOUND',
      'AML Rule source record was not found in blockchain.valoores_aml_rules',
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
    throw new AmlRulesProofError(
      'AML_RULE_SOURCE_RECORD_INVALID',
      'AML Rule source record is missing required proof fields',
      422,
      {
        sourceView: SOURCE_VIEW,
        sourceRecordId: row.source_record_id || null,
        missingColumns
      }
    );
  }

  if (String(row.source_entity).trim().toUpperCase() !== MODULE_NAME) {
    throw new AmlRulesProofError(
      'AML_RULE_SOURCE_ENTITY_INVALID',
      `AML Rule source_entity must be ${MODULE_NAME}`,
      422,
      {
        sourceEntity: row.source_entity
      }
    );
  }
}

async function getAmlRuleSourceRecord(sourceRecordId) {
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
      FROM blockchain.valoores_aml_rules
      WHERE source_record_id = $1
      LIMIT 1
    `,
    [normalizedSourceRecordId]
  );

  const row = result.rows[0] || null;
  validateSourceRecord(row);

  return row;
}

function generateAmlRuleRecordHash(sourceRecord) {
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

function buildAmlRuleProofPayload(sourceRecord, options = {}) {
  validateSourceRecord(sourceRecord);

  const hashData = generateAmlRuleRecordHash(sourceRecord);

  const keyData = blockchainKeyGenerator.generateBlockchainKey({
    moduleName: sourceRecord.source_entity || MODULE_NAME,
    sourceRecordId: sourceRecord.source_record_id,
    hashVersion: sourceRecord.proof_version || 'V1'
  });

  return {
    blockchainKey: keyData.blockchainKey,
    moduleName: keyData.moduleName,
    sourceRecordId: keyData.sourceRecordId,
    recordHash: hashData.recordHash,
    hashVersion: keyData.hashVersion,
    actionType: options.actionType || DEFAULT_ACTION_TYPE,
    approvedBy: options.approvedBy || options.submittedBy || SERVICE_NAME
  };
}

async function previewAmlRuleProof(sourceRecordId, options = {}) {
  const sourceRecord = await getAmlRuleSourceRecord(sourceRecordId);
  const proofPayload = buildAmlRuleProofPayload(sourceRecord, options);

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

async function submitAmlRuleProof(sourceRecordId, options = {}) {
  const sourceRecord = await getAmlRuleSourceRecord(sourceRecordId);
  const proofPayload = buildAmlRuleProofPayload(sourceRecord, options);

  const submission = await blockchainApiProofService.submitProof(
    proofPayload,
    {
      requestedBy: options.submittedBy || options.approvedBy || SERVICE_NAME,
      requestSource: 'POST /api/v1/government-blockchain/valoores-aml-rules/proof/submit'
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


function buildAmlRuleVerificationPayload(sourceRecord, options = {}) {
  const proofPayload = buildAmlRuleProofPayload(sourceRecord, options);

  return {
    blockchainKey: proofPayload.blockchainKey,
    recordHash: proofPayload.recordHash
  };
}

async function previewAmlRuleVerification(sourceRecordId, options = {}) {
  const sourceRecord = await getAmlRuleSourceRecord(sourceRecordId);
  const proofPayload = buildAmlRuleProofPayload(sourceRecord, options);
  const verificationPayload = buildAmlRuleVerificationPayload(sourceRecord, options);

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

async function verifyAmlRuleProof(sourceRecordId, options = {}) {
  const sourceRecord = await getAmlRuleSourceRecord(sourceRecordId);
  const proofPayload = buildAmlRuleProofPayload(sourceRecord, options);
  const verificationPayload = buildAmlRuleVerificationPayload(sourceRecord, options);

  const verification = await blockchainApiProofService.verifyProof(
    verificationPayload,
    {
      requestedBy: options.verifiedBy ||
        options.submittedBy ||
        options.approvedBy ||
        SERVICE_NAME,
      requestSource: 'POST /api/v1/government-blockchain/valoores-aml-rules/proof/verify'
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

module.exports = {
  SOURCE_VIEW,
  MODULE_NAME,
  DEFAULT_ACTION_TYPE,
  SERVICE_NAME,
  AmlRulesProofError,
  getAmlRuleSourceRecord,
  generateAmlRuleRecordHash,
  buildAmlRuleProofPayload,
  buildAmlRuleVerificationPayload,
  previewAmlRuleProof,
  previewAmlRuleVerification,
  submitAmlRuleProof,
  verifyAmlRuleProof
};
