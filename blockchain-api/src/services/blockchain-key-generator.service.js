'use strict';

/**
 * Phase 9 — Blockchain Key Generator Service
 *
 * Format:
 * VALOORES:{MODULE}:{SOURCE_RECORD_ID}:{HASH_VERSION}
 */

const KEY_NAMESPACE = 'VALOORES';
const KEY_SEPARATOR = ':';
const DEFAULT_HASH_VERSION = 'V1';
const MAX_SOURCE_RECORD_ID_LENGTH = 128;
const KEY_FORMAT = 'VALOORES:{MODULE}:{SOURCE_RECORD_ID}:{HASH_VERSION}';

const APPROVED_MODULES = Object.freeze([
  'AML_RULE',
  'CUSTOMER_KYC',
  'TRANSACTION',
  'AML_ALERT',
  'AUDIT_LOG',
  'SCREENING_ACTIVITY',
  'SANCTION_LIST',
  'CASE_CLOSURE',
  'EVIDENCE'
]);

const MODULE_ALIASES = Object.freeze({
  AML: 'AML_RULE',
  AML_RULES: 'AML_RULE',
  VALOORES_AML_RULES: 'AML_RULE',
  CUSTOMER_DATA: 'CUSTOMER_KYC',
  CUSTOMER: 'CUSTOMER_KYC',
  KYC: 'CUSTOMER_KYC',
  TRANSACTION_DATA: 'TRANSACTION',
  TRANSACTIONS: 'TRANSACTION',
  SCREENING: 'SCREENING_ACTIVITY',
  SANCTION: 'SANCTION_LIST',
  SANCTIONS: 'SANCTION_LIST',
  AML_CASE_CLOSURE: 'CASE_CLOSURE',
  CASE: 'CASE_CLOSURE',
  EVIDENCE_CHAIN: 'EVIDENCE'
});

function createValidationError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'BlockchainKeyValidationError';
  error.code = code;
  error.details = details;
  return error;
}

function requireText(value, fieldName) {
  if (value === null || value === undefined) {
    throw createValidationError(`${fieldName.toUpperCase()}_REQUIRED`, `${fieldName} is required`);
  }

  const text = String(value).trim();

  if (!text) {
    throw createValidationError(`${fieldName.toUpperCase()}_REQUIRED`, `${fieldName} is required`);
  }

  return text;
}

function normalizeModuleName(moduleName) {
  const normalized = requireText(moduleName, 'moduleName')
    .replace(/[\s-]+/g, '_')
    .toUpperCase();

  const resolved = MODULE_ALIASES[normalized] || normalized;

  if (!/^[A-Z0-9_]+$/.test(resolved)) {
    throw createValidationError(
      'INVALID_MODULE_NAME_FORMAT',
      'moduleName must contain only uppercase letters, numbers, and underscore',
      { moduleName }
    );
  }

  if (!APPROVED_MODULES.includes(resolved)) {
    throw createValidationError(
      'UNAPPROVED_MODULE_NAME',
      `moduleName must be one of: ${APPROVED_MODULES.join(', ')}`,
      { moduleName, normalizedModuleName: resolved, approvedModules: [...APPROVED_MODULES] }
    );
  }

  return resolved;
}

function normalizeSourceRecordId(sourceRecordId, options = {}) {
  const shouldUppercase = options.uppercase !== false;
  const text = requireText(sourceRecordId, 'sourceRecordId');
  const normalized = shouldUppercase ? text.toUpperCase() : text;

  if (normalized.length > MAX_SOURCE_RECORD_ID_LENGTH) {
    throw createValidationError(
      'SOURCE_RECORD_ID_TOO_LONG',
      `sourceRecordId must not exceed ${MAX_SOURCE_RECORD_ID_LENGTH} characters`,
      { sourceRecordId, maxLength: MAX_SOURCE_RECORD_ID_LENGTH }
    );
  }

  if (normalized.includes(KEY_SEPARATOR)) {
    throw createValidationError(
      'INVALID_SOURCE_RECORD_ID_SEPARATOR',
      `sourceRecordId must not contain ${KEY_SEPARATOR}`,
      { sourceRecordId }
    );
  }

  if (/\s/.test(normalized)) {
    throw createValidationError(
      'INVALID_SOURCE_RECORD_ID_WHITESPACE',
      'sourceRecordId must not contain whitespace',
      { sourceRecordId }
    );
  }

  if (!/^[A-Z0-9_.-]+$/.test(normalized)) {
    throw createValidationError(
      'INVALID_SOURCE_RECORD_ID_FORMAT',
      'sourceRecordId must contain only letters, numbers, underscore, dash, and dot',
      { sourceRecordId }
    );
  }

  return normalized;
}

function normalizeHashVersion(hashVersion = DEFAULT_HASH_VERSION) {
  const text = requireText(hashVersion || DEFAULT_HASH_VERSION, 'hashVersion').toUpperCase();

  if (text.includes(KEY_SEPARATOR)) {
    throw createValidationError(
      'INVALID_HASH_VERSION_SEPARATOR',
      `hashVersion must not contain ${KEY_SEPARATOR}`,
      { hashVersion }
    );
  }

  if (!/^V[0-9]+$/.test(text)) {
    throw createValidationError(
      'INVALID_HASH_VERSION_FORMAT',
      'hashVersion must match V followed by a number, for example V1',
      { hashVersion }
    );
  }

  return text;
}

function getApprovedModules() {
  return [...APPROVED_MODULES];
}

function generateBlockchainKey(input = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw createValidationError('INVALID_INPUT', 'generateBlockchainKey input must be an object');
  }

  const moduleName = normalizeModuleName(input.moduleName || input.module || input.recordType);
  const sourceRecordId = normalizeSourceRecordId(
    input.sourceRecordId || input.source_record_id,
    input
  );
  const hashVersion = normalizeHashVersion(
    input.hashVersion || input.hash_version || DEFAULT_HASH_VERSION
  );

  const blockchainKey = [
    KEY_NAMESPACE,
    moduleName,
    sourceRecordId,
    hashVersion
  ].join(KEY_SEPARATOR);

  return {
    blockchainKey,
    namespace: KEY_NAMESPACE,
    moduleName,
    sourceRecordId,
    hashVersion,
    keyFormat: KEY_FORMAT
  };
}

function parseBlockchainKey(blockchainKey) {
  const key = requireText(blockchainKey, 'blockchainKey');
  const parts = key.split(KEY_SEPARATOR);

  if (parts.length !== 4) {
    throw createValidationError(
      'INVALID_BLOCKCHAIN_KEY_PART_COUNT',
      'blockchainKey must have exactly 4 parts',
      { blockchainKey, expectedFormat: KEY_FORMAT }
    );
  }

  const [namespace, moduleName, sourceRecordId, hashVersion] = parts;

  if (namespace !== KEY_NAMESPACE) {
    throw createValidationError(
      'INVALID_BLOCKCHAIN_KEY_NAMESPACE',
      `blockchainKey namespace must be ${KEY_NAMESPACE}`,
      { blockchainKey, namespace }
    );
  }

  const normalizedModuleName = normalizeModuleName(moduleName);
  const normalizedSourceRecordId = normalizeSourceRecordId(sourceRecordId);
  const normalizedHashVersion = normalizeHashVersion(hashVersion);

  return {
    blockchainKey: [
      KEY_NAMESPACE,
      normalizedModuleName,
      normalizedSourceRecordId,
      normalizedHashVersion
    ].join(KEY_SEPARATOR),
    namespace: KEY_NAMESPACE,
    moduleName: normalizedModuleName,
    sourceRecordId: normalizedSourceRecordId,
    hashVersion: normalizedHashVersion,
    keyFormat: KEY_FORMAT
  };
}

function validateBlockchainKey(blockchainKey) {
  return {
    valid: true,
    ...parseBlockchainKey(blockchainKey)
  };
}

module.exports = {
  KEY_NAMESPACE,
  KEY_SEPARATOR,
  DEFAULT_HASH_VERSION,
  MAX_SOURCE_RECORD_ID_LENGTH,
  KEY_FORMAT,
  APPROVED_MODULES,
  MODULE_ALIASES,
  createValidationError,
  normalizeModuleName,
  normalizeSourceRecordId,
  normalizeHashVersion,
  getApprovedModules,
  generateBlockchainKey,
  parseBlockchainKey,
  validateBlockchainKey
};
