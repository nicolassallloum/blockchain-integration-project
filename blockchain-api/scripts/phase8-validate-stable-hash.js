'use strict';

/**
 * Phase 8 — Stable Hash Generator CLI Validation
 *
 * This script validates the stable hash generator behavior without requiring
 * PostgreSQL, Fabric, or any external service.
 */

const assert = require('node:assert/strict');

const {
  HASH_VERSION,
  generateRecordHash,
  toCanonicalJson
} = require('../src/services/stable-hash-generator.service');

function printSection(title) {
  console.log(`\n===== ${title} =====`);
}

function main() {
  printSection('PHASE 8 HASH VALIDATION STARTED');

  const originalInput = {
    source_record_id: '  AML-1001  ',
    module_name: '  AML_RULES  ',
    customer_name: '  Nicolas Salloum  ',
    amount: '00100.5000',
    event_date: '2026-07-01 12:30:45',
    risk_score: '00085.00',
    nested_payload: {
      z_field: '  last  ',
      a_field: '  first  '
    },
    updated_at: '2026-07-01T10:00:00Z',
    blockchain_transaction_id: 'TX-OLD-001',
    verification_status: 'OLD_STATUS'
  };

  const sameBusinessInput = {
    verification_status: 'NEW_STATUS',
    blockchain_transaction_id: 'TX-NEW-999',
    updated_at: '2030-01-01T00:00:00Z',
    nested_payload: {
      a_field: 'first',
      z_field: 'last'
    },
    risk_score: 85,
    event_date: '2026-07-01T12:30:45.000Z',
    amount: 100.5,
    customer_name: 'Nicolas Salloum',
    module_name: 'AML_RULES',
    source_record_id: 'AML-1001'
  };

  const changedBusinessInput = {
    verification_status: 'NEW_STATUS',
    blockchain_transaction_id: 'TX-NEW-999',
    updated_at: '2030-01-01T00:00:00Z',
    nested_payload: {
      a_field: 'first',
      z_field: 'last'
    },
    risk_score: 85,
    event_date: '2026-07-01T12:30:45.000Z',
    amount: 100.5,
    customer_name: 'Nicolas Updated',
    module_name: 'AML_RULES',
    source_record_id: 'AML-1001'
  };

  const originalResult = generateRecordHash(originalInput);
  const sameBusinessResult = generateRecordHash(sameBusinessInput);
  const changedBusinessResult = generateRecordHash(changedBusinessInput);

  printSection('CANONICAL JSON ORIGINAL');
  console.log(originalResult.canonicalJson);

  printSection('CANONICAL JSON SAME BUSINESS INPUT');
  console.log(sameBusinessResult.canonicalJson);

  printSection('CANONICAL JSON CHANGED BUSINESS INPUT');
  console.log(changedBusinessResult.canonicalJson);

  printSection('HASH RESULTS');
  console.log(JSON.stringify({
    hashVersion: HASH_VERSION,
    originalHash: originalResult.recordHash,
    sameBusinessHash: sameBusinessResult.recordHash,
    changedBusinessHash: changedBusinessResult.recordHash
  }, null, 2));

  assert.equal(originalResult.hashVersion, HASH_VERSION);
  assert.equal(originalResult.hashAlgorithm, 'sha256');
  assert.equal(originalResult.recordHash.length, 64);
  assert.match(originalResult.recordHash, /^[a-f0-9]{64}$/);

  assert.equal(
    originalResult.recordHash,
    sameBusinessResult.recordHash,
    'Same business data must produce the same hash'
  );

  assert.equal(
    originalResult.canonicalJson,
    sameBusinessResult.canonicalJson,
    'Same business data must produce the same canonical JSON'
  );

  assert.notEqual(
    originalResult.recordHash,
    changedBusinessResult.recordHash,
    'Changed business data must produce a different hash'
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(originalResult.canonicalRecord, 'updated_at'),
    false,
    'updated_at must be excluded'
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(originalResult.canonicalRecord, 'blockchain_transaction_id'),
    false,
    'blockchain_transaction_id must be excluded'
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(originalResult.canonicalRecord, 'verification_status'),
    false,
    'verification_status must be excluded'
  );

  assert.equal(
    toCanonicalJson(originalInput),
    toCanonicalJson(sameBusinessInput),
    'Canonical JSON helper must also be stable'
  );

  printSection('PHASE 8 HASH VALIDATION PASSED');

  console.log(JSON.stringify({
    passed: true,
    hashVersion: HASH_VERSION,
    stableHashConfirmed: true,
    changedInputDifferenceConfirmed: true,
    volatileFieldsExcluded: true
  }, null, 2));
}

main();
