'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  KEY_NAMESPACE,
  KEY_SEPARATOR,
  DEFAULT_HASH_VERSION,
  MAX_SOURCE_RECORD_ID_LENGTH,
  KEY_FORMAT,
  APPROVED_MODULES,
  normalizeModuleName,
  normalizeSourceRecordId,
  normalizeHashVersion,
  getApprovedModules,
  generateBlockchainKey,
  parseBlockchainKey,
  validateBlockchainKey
} = require('../src/services/blockchain-key-generator.service');

function assertValidationError(fn, expectedCode) {
  assert.throws(
    fn,
    (error) => {
      assert.equal(error.name, 'BlockchainKeyValidationError');
      assert.equal(error.code, expectedCode);
      return true;
    }
  );
}

test('returns configured key constants', () => {
  assert.equal(KEY_NAMESPACE, 'VALOORES');
  assert.equal(KEY_SEPARATOR, ':');
  assert.equal(DEFAULT_HASH_VERSION, 'V1');
  assert.equal(MAX_SOURCE_RECORD_ID_LENGTH, 128);
  assert.equal(KEY_FORMAT, 'VALOORES:{MODULE}:{SOURCE_RECORD_ID}:{HASH_VERSION}');
});

test('returns approved module list copy', () => {
  const modules = getApprovedModules();

  assert.deepEqual(modules, [...APPROVED_MODULES]);
  assert.equal(modules.includes('AML_RULE'), true);
  assert.equal(modules.includes('CUSTOMER_KYC'), true);
  assert.equal(modules.includes('EVIDENCE'), true);

  modules.push('FAKE_MODULE');
  assert.equal(getApprovedModules().includes('FAKE_MODULE'), false);
});

test('generates recommended example keys', () => {
  assert.equal(
    generateBlockchainKey({
      moduleName: 'AML_RULE',
      sourceRecordId: 'RULE_1001',
      hashVersion: 'V1'
    }).blockchainKey,
    'VALOORES:AML_RULE:RULE_1001:V1'
  );

  assert.equal(
    generateBlockchainKey({
      moduleName: 'CUSTOMER_KYC',
      sourceRecordId: 'CUST_5001',
      hashVersion: 'V1'
    }).blockchainKey,
    'VALOORES:CUSTOMER_KYC:CUST_5001:V1'
  );

  assert.equal(
    generateBlockchainKey({
      moduleName: 'CASE_CLOSURE',
      sourceRecordId: 'CASE_9001',
      hashVersion: 'V1'
    }).blockchainKey,
    'VALOORES:CASE_CLOSURE:CASE_9001:V1'
  );

  assert.equal(
    generateBlockchainKey({
      moduleName: 'EVIDENCE',
      sourceRecordId: 'EVD_7001',
      hashVersion: 'V1'
    }).blockchainKey,
    'VALOORES:EVIDENCE:EVD_7001:V1'
  );
});

test('normalizes module, source record ID, and default hash version', () => {
  const result = generateBlockchainKey({
    moduleName: ' aml_rule ',
    sourceRecordId: ' rule_1001 '
  });

  assert.deepEqual(result, {
    blockchainKey: 'VALOORES:AML_RULE:RULE_1001:V1',
    namespace: 'VALOORES',
    moduleName: 'AML_RULE',
    sourceRecordId: 'RULE_1001',
    hashVersion: 'V1',
    keyFormat: 'VALOORES:{MODULE}:{SOURCE_RECORD_ID}:{HASH_VERSION}'
  });
});

test('supports explicit hash version', () => {
  const result = generateBlockchainKey({
    moduleName: 'CUSTOMER_KYC',
    sourceRecordId: 'cust_5001',
    hashVersion: 'v2'
  });

  assert.equal(result.blockchainKey, 'VALOORES:CUSTOMER_KYC:CUST_5001:V2');
  assert.equal(result.hashVersion, 'V2');
});

test('supports module aliases used by existing project', () => {
  assert.equal(normalizeModuleName('AML'), 'AML_RULE');
  assert.equal(normalizeModuleName('AML_RULES'), 'AML_RULE');
  assert.equal(normalizeModuleName('CUSTOMER_DATA'), 'CUSTOMER_KYC');
  assert.equal(normalizeModuleName('TRANSACTION_DATA'), 'TRANSACTION');
  assert.equal(normalizeModuleName('SCREENING'), 'SCREENING_ACTIVITY');
  assert.equal(normalizeModuleName('SANCTION'), 'SANCTION_LIST');
  assert.equal(normalizeModuleName('AML_CASE_CLOSURE'), 'CASE_CLOSURE');
  assert.equal(normalizeModuleName('EVIDENCE_CHAIN'), 'EVIDENCE');
});

test('normalizes source record IDs', () => {
  assert.equal(normalizeSourceRecordId(' cust-5001.01 '), 'CUST-5001.01');
  assert.equal(normalizeSourceRecordId('rule_1001'), 'RULE_1001');
  assert.equal(normalizeSourceRecordId('EVD.7001-01'), 'EVD.7001-01');
});

test('normalizes hash versions', () => {
  assert.equal(normalizeHashVersion(), 'V1');
  assert.equal(normalizeHashVersion(' v1 '), 'V1');
  assert.equal(normalizeHashVersion('v10'), 'V10');
});

test('parses valid blockchain key', () => {
  const parsed = parseBlockchainKey('VALOORES:AML_RULE:RULE_1001:V1');

  assert.deepEqual(parsed, {
    blockchainKey: 'VALOORES:AML_RULE:RULE_1001:V1',
    namespace: 'VALOORES',
    moduleName: 'AML_RULE',
    sourceRecordId: 'RULE_1001',
    hashVersion: 'V1',
    keyFormat: 'VALOORES:{MODULE}:{SOURCE_RECORD_ID}:{HASH_VERSION}'
  });
});

test('validates valid blockchain key', () => {
  const validation = validateBlockchainKey('VALOORES:EVIDENCE:EVD_7001:V1');

  assert.equal(validation.valid, true);
  assert.equal(validation.blockchainKey, 'VALOORES:EVIDENCE:EVD_7001:V1');
  assert.equal(validation.moduleName, 'EVIDENCE');
});

test('rejects invalid module names', () => {
  assertValidationError(
    () => normalizeModuleName('UNKNOWN_MODULE'),
    'UNAPPROVED_MODULE_NAME'
  );

  assertValidationError(
    () => normalizeModuleName('CUSTOMER:KYC'),
    'INVALID_MODULE_NAME_FORMAT'
  );
});

test('rejects invalid source record IDs', () => {
  assertValidationError(
    () => normalizeSourceRecordId(''),
    'SOURCERECORDID_REQUIRED'
  );

  assertValidationError(
    () => normalizeSourceRecordId('RULE 1001'),
    'INVALID_SOURCE_RECORD_ID_WHITESPACE'
  );

  assertValidationError(
    () => normalizeSourceRecordId('RULE:1001'),
    'INVALID_SOURCE_RECORD_ID_SEPARATOR'
  );

  assertValidationError(
    () => normalizeSourceRecordId('RULE/1001'),
    'INVALID_SOURCE_RECORD_ID_FORMAT'
  );
});

test('rejects source record IDs longer than limit', () => {
  assertValidationError(
    () => normalizeSourceRecordId('A'.repeat(129)),
    'SOURCE_RECORD_ID_TOO_LONG'
  );
});

test('rejects invalid hash versions', () => {
  assertValidationError(
    () => normalizeHashVersion('1'),
    'INVALID_HASH_VERSION_FORMAT'
  );

  assertValidationError(
    () => normalizeHashVersion('VERSION1'),
    'INVALID_HASH_VERSION_FORMAT'
  );

  assertValidationError(
    () => normalizeHashVersion('V1:TEST'),
    'INVALID_HASH_VERSION_SEPARATOR'
  );
});

test('rejects invalid blockchain keys', () => {
  assertValidationError(
    () => parseBlockchainKey('VALOORES:AML_RULE:RULE_1001'),
    'INVALID_BLOCKCHAIN_KEY_PART_COUNT'
  );

  assertValidationError(
    () => parseBlockchainKey('OTHER:AML_RULE:RULE_1001:V1'),
    'INVALID_BLOCKCHAIN_KEY_NAMESPACE'
  );

  assertValidationError(
    () => parseBlockchainKey('VALOORES:UNKNOWN:RULE_1001:V1'),
    'UNAPPROVED_MODULE_NAME'
  );
});

test('rejects invalid generate input', () => {
  assertValidationError(
    () => generateBlockchainKey(null),
    'INVALID_INPUT'
  );

  assertValidationError(
    () => generateBlockchainKey([]),
    'INVALID_INPUT'
  );

  assertValidationError(
    () => generateBlockchainKey({ moduleName: 'AML_RULE' }),
    'SOURCERECORDID_REQUIRED'
  );
});
