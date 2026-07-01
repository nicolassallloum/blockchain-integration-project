'use strict';

/**
 * Phase 8 — Stable Hash Generator Service
 *
 * Purpose:
 * Generate deterministic SHA-256 hashes for blockchain proof records.
 *
 * Stability rules:
 * 1. Convert record data to canonical JSON.
 * 2. Sort all object keys alphabetically.
 * 3. Trim text values.
 * 4. Normalize dates.
 * 5. Normalize numbers.
 * 6. Handle null values consistently.
 * 7. Remove excluded fields before hashing.
 * 8. Generate SHA-256 hash.
 * 9. Return hash version metadata.
 */

const crypto = require('crypto');

const HASH_ALGORITHM = 'sha256';
const HASH_ENCODING = 'hex';
const HASH_VERSION = 'sha256-canonical-json-v1';

const DEFAULT_EXCLUDED_FIELDS = Object.freeze([
  'created_at',
  'updated_at',
  'submitted_at',
  'verified_at',
  'blockchain_transaction_id',
  'blockchain_status',
  'verification_status',
  'error_message',
  'retry_count',
  'record_hash',
  'hash',
  'hash_version'
]);

const DEFAULT_DATE_FIELD_PATTERNS = Object.freeze([
  /(^|_)date$/,
  /(^|_)date_/,
  /_date$/,
  /_at$/,
  /_on$/,
  /^date$/,
  /^timestamp$/,
  /^time$/
]);

const DEFAULT_NUMERIC_FIELD_PATTERNS = Object.freeze([
  /(^|_)amount$/,
  /(^|_)balance$/,
  /(^|_)count$/,
  /(^|_)fee$/,
  /(^|_)limit$/,
  /(^|_)number$/,
  /(^|_)percent$/,
  /(^|_)percentage$/,
  /(^|_)price$/,
  /(^|_)quantity$/,
  /(^|_)qty$/,
  /(^|_)rate$/,
  /(^|_)score$/,
  /(^|_)total$/,
  /(^|_)value$/
]);

function getHashVersion() {
  return HASH_VERSION;
}

function normalizeFieldName(fieldName) {
  return String(fieldName || '').trim().toLowerCase();
}

function buildExcludedFieldSet(options = {}) {
  const excludeFields = Array.isArray(options.excludeFields)
    ? options.excludeFields
    : [];

  const includeDefaultExcludedFields = options.includeDefaultExcludedFields !== false;

  const fields = includeDefaultExcludedFields
    ? [...DEFAULT_EXCLUDED_FIELDS, ...excludeFields]
    : [...excludeFields];

  return new Set(fields.map(normalizeFieldName).filter(Boolean));
}

function shouldExcludeField(fieldName, excludedFields) {
  return excludedFields.has(normalizeFieldName(fieldName));
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isValidDateObject(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function shouldTreatAsDateField(fieldName, options = {}) {
  const normalizedFieldName = normalizeFieldName(fieldName);

  if (!normalizedFieldName) {
    return false;
  }

  const explicitDateFields = Array.isArray(options.dateFields)
    ? options.dateFields.map(normalizeFieldName)
    : [];

  if (explicitDateFields.includes(normalizedFieldName)) {
    return true;
  }

  return DEFAULT_DATE_FIELD_PATTERNS.some((pattern) => pattern.test(normalizedFieldName));
}

function shouldTreatAsNumericField(fieldName, options = {}) {
  const normalizedFieldName = normalizeFieldName(fieldName);

  if (!normalizedFieldName) {
    return false;
  }

  const explicitNumericFields = Array.isArray(options.numericFields)
    ? options.numericFields.map(normalizeFieldName)
    : [];

  if (explicitNumericFields.includes(normalizedFieldName)) {
    return true;
  }

  return DEFAULT_NUMERIC_FIELD_PATTERNS.some((pattern) => pattern.test(normalizedFieldName));
}

function normalizeDateValue(value) {
  if (isValidDateObject(value)) {
    return value.toISOString();
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,9})?$/.test(trimmed)) {
    const normalized = trimmed.replace(' ', 'T');
    const date = new Date(`${normalized}Z`);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  const parsed = new Date(trimmed);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return trimmed;
}

function expandExponentialNumber(value) {
  const valueAsString = String(value);

  if (!/[eE]/.test(valueAsString)) {
    return valueAsString;
  }

  const [coefficient, exponentPart] = valueAsString.toLowerCase().split('e');
  const exponent = Number(exponentPart);

  if (!Number.isInteger(exponent)) {
    return valueAsString;
  }

  const sign = coefficient.startsWith('-') ? '-' : '';
  const unsignedCoefficient = coefficient.replace(/^[+-]/, '');
  const [integerPart, decimalPart = ''] = unsignedCoefficient.split('.');
  const digits = `${integerPart}${decimalPart}`;

  if (exponent >= 0) {
    const decimalLength = decimalPart.length;
    const zerosToAdd = exponent - decimalLength;

    if (zerosToAdd >= 0) {
      return `${sign}${digits}${'0'.repeat(zerosToAdd)}`;
    }

    const splitPosition = digits.length + zerosToAdd;
    return `${sign}${digits.slice(0, splitPosition)}.${digits.slice(splitPosition)}`;
  }

  const zerosToAdd = Math.abs(exponent) - integerPart.length;

  if (zerosToAdd >= 0) {
    return `${sign}0.${'0'.repeat(zerosToAdd)}${digits}`;
  }

  const splitPosition = integerPart.length + exponent;
  return `${sign}${digits.slice(0, splitPosition)}.${digits.slice(splitPosition)}`;
}

function normalizeNumericString(value) {
  const trimmed = String(value).trim().replace(/,/g, '');

  if (!/^[+-]?\d+(\.\d+)?$/.test(trimmed)) {
    return String(value).trim();
  }

  const negative = trimmed.startsWith('-');
  const unsigned = trimmed.replace(/^[+-]/, '');
  const [integerPart, decimalPart = ''] = unsigned.split('.');

  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, '') || '0';
  const normalizedDecimal = decimalPart.replace(/0+$/, '');

  const normalized = normalizedDecimal
    ? `${normalizedInteger}.${normalizedDecimal}`
    : normalizedInteger;

  if (normalized === '0') {
    return '0';
  }

  return negative ? `-${normalized}` : normalized;
}

function normalizeNumberValue(value) {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }

    return normalizeNumericString(expandExponentialNumber(value));
  }

  if (typeof value === 'string') {
    return normalizeNumericString(value);
  }

  return value;
}

function normalizeStringValue(value, fieldName, options = {}) {
  const trimmed = value.trim();

  if (shouldTreatAsDateField(fieldName, options)) {
    return normalizeDateValue(trimmed);
  }

  if (shouldTreatAsNumericField(fieldName, options)) {
    return normalizeNumberValue(trimmed);
  }

  return trimmed;
}

function canonicalizeValue(value, fieldName, options, excludedFields) {
  if (value === undefined || value === null) {
    return null;
  }

  if (isValidDateObject(value)) {
    return normalizeDateValue(value);
  }

  if (typeof value === 'string') {
    return normalizeStringValue(value, fieldName, options);
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return shouldTreatAsNumericField(fieldName, options)
      ? normalizeNumberValue(value)
      : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeValue(item, fieldName, options, excludedFields));
  }

  if (isPlainObject(value)) {
    return canonicalizeObject(value, options, excludedFields);
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return String(value).trim();
}

function canonicalizeObject(record, options, excludedFields) {
  const canonicalRecord = {};

  Object.keys(record)
    .filter((key) => !shouldExcludeField(key, excludedFields))
    .sort((a, b) => a.localeCompare(b))
    .forEach((key) => {
      canonicalRecord[key] = canonicalizeValue(record[key], key, options, excludedFields);
    });

  return canonicalRecord;
}

function canonicalizeRecord(record, options = {}) {
  if (!isPlainObject(record)) {
    throw new TypeError('stable hash generator expects record to be a plain object');
  }

  const excludedFields = buildExcludedFieldSet(options);

  return canonicalizeObject(record, options, excludedFields);
}

function toCanonicalJson(record, options = {}) {
  return JSON.stringify(canonicalizeRecord(record, options));
}

function generateSha256Hash(value) {
  return crypto
    .createHash(HASH_ALGORITHM)
    .update(value, 'utf8')
    .digest(HASH_ENCODING);
}

function generateRecordHash(record, options = {}) {
  const canonicalRecord = canonicalizeRecord(record, options);
  const canonicalJson = JSON.stringify(canonicalRecord);
  const recordHash = generateSha256Hash(canonicalJson);

  return {
    hashVersion: options.hashVersion || HASH_VERSION,
    hashAlgorithm: HASH_ALGORITHM,
    hashEncoding: HASH_ENCODING,
    recordHash,
    canonicalJson,
    canonicalRecord
  };
}

module.exports = {
  HASH_ALGORITHM,
  HASH_ENCODING,
  HASH_VERSION,
  DEFAULT_EXCLUDED_FIELDS,
  canonicalizeRecord,
  toCanonicalJson,
  generateRecordHash,
  getHashVersion
};
