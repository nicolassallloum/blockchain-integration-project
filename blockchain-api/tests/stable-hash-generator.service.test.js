'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HASH_ALGORITHM,
  HASH_ENCODING,
  HASH_VERSION,
  DEFAULT_EXCLUDED_FIELDS,
  canonicalizeRecord,
  toCanonicalJson,
  generateRecordHash,
  getHashVersion
} = require('../src/services/stable-hash-generator.service');

test('returns the configured hash version metadata', () => {
  assert.equal(getHashVersion(), HASH_VERSION);
  assert.equal(HASH_VERSION, 'sha256-canonical-json-v1');
  assert.equal(HASH_ALGORITHM, 'sha256');
  assert.equal(HASH_ENCODING, 'hex');
});

test('sorts object keys alphabetically in canonical JSON', () => {
  const canonicalJson = toCanonicalJson({
    zebra: 'last',
    alpha: 'first',
    middle: 'center'
  });

  assert.equal(
    canonicalJson,
    '{"alpha":"first","middle":"center","zebra":"last"}'
  );
});

test('trims text values recursively', () => {
  const canonicalRecord = canonicalizeRecord({
    name: '  Nicolas Salloum  ',
    nested: {
      city: '  Beirut  '
    },
    list: [
      {
        label: '  AML  '
      }
    ]
  });

  assert.deepEqual(canonicalRecord, {
    list: [
      {
        label: 'AML'
      }
    ],
    name: 'Nicolas Salloum',
    nested: {
      city: 'Beirut'
    }
  });
});

test('generates same hash for same business data with different key order and whitespace', () => {
  const firstInput = {
    source_record_id: '  AML-1001  ',
    customer_name: '  Nicolas Salloum  ',
    amount: '00100.5000',
    event_date: '2026-07-01 12:30:45',
    updated_at: '2026-07-01T10:00:00Z',
    nested: {
      z_key: '  last  ',
      a_key: '  first  '
    }
  };

  const secondInput = {
    nested: {
      a_key: 'first',
      z_key: 'last'
    },
    updated_at: '2030-01-01T00:00:00Z',
    event_date: '2026-07-01T12:30:45.000Z',
    amount: 100.5,
    customer_name: 'Nicolas Salloum',
    source_record_id: 'AML-1001'
  };

  const firstResult = generateRecordHash(firstInput);
  const secondResult = generateRecordHash(secondInput);

  assert.equal(firstResult.recordHash, secondResult.recordHash);
  assert.equal(firstResult.canonicalJson, secondResult.canonicalJson);
  assert.equal(firstResult.recordHash.length, 64);
  assert.match(firstResult.recordHash, /^[a-f0-9]{64}$/);
});

test('generates different hash when business data changes', () => {
  const original = generateRecordHash({
    source_record_id: 'AML-1001',
    customer_name: 'Nicolas Salloum',
    amount: '100.50'
  });

  const changed = generateRecordHash({
    source_record_id: 'AML-1001',
    customer_name: 'Nicolas Updated',
    amount: '100.50'
  });

  assert.notEqual(original.recordHash, changed.recordHash);
});

test('normalizes date values consistently', () => {
  const first = canonicalizeRecord({
    event_date: '2026-07-01 12:30:45'
  });

  const second = canonicalizeRecord({
    event_date: '2026-07-01T12:30:45.000Z'
  });

  assert.deepEqual(first, second);
  assert.equal(first.event_date, '2026-07-01T12:30:45.000Z');
});

test('normalizes numeric fields consistently', () => {
  const first = canonicalizeRecord({
    amount: '00100.5000',
    count: '00025',
    rate: '01.2500'
  });

  const second = canonicalizeRecord({
    amount: 100.5,
    count: 25,
    rate: 1.25
  });

  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    amount: '100.5',
    count: '25',
    rate: '1.25'
  });
});

test('handles null and undefined values consistently', () => {
  const first = canonicalizeRecord({
    note: null,
    optional_value: undefined
  });

  const second = canonicalizeRecord({
    note: undefined,
    optional_value: null
  });

  assert.deepEqual(first, {
    note: null,
    optional_value: null
  });

  assert.deepEqual(second, {
    note: null,
    optional_value: null
  });
});

test('removes default excluded volatile fields before hashing', () => {
  const result = generateRecordHash({
    source_record_id: 'AML-1001',
    customer_name: 'Nicolas Salloum',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    submitted_at: '2026-01-03T00:00:00Z',
    verified_at: '2026-01-04T00:00:00Z',
    blockchain_transaction_id: 'TX-123',
    blockchain_status: 'SUCCESS',
    verification_status: 'MATCHED',
    error_message: 'none',
    retry_count: 3,
    record_hash: 'old-hash',
    hash: 'old-hash',
    hash_version: 'old-version'
  });

  for (const field of DEFAULT_EXCLUDED_FIELDS) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(result.canonicalRecord, field),
      false,
      `${field} should be excluded`
    );
  }

  assert.deepEqual(result.canonicalRecord, {
    customer_name: 'Nicolas Salloum',
    source_record_id: 'AML-1001'
  });
});

test('supports custom exclude fields', () => {
  const result = generateRecordHash(
    {
      source_record_id: 'AML-1001',
      customer_name: 'Nicolas Salloum',
      internal_comment: 'Do not hash this'
    },
    {
      excludeFields: ['internal_comment']
    }
  );

  assert.deepEqual(result.canonicalRecord, {
    customer_name: 'Nicolas Salloum',
    source_record_id: 'AML-1001'
  });
});

test('supports explicit dateFields and numericFields options', () => {
  const first = canonicalizeRecord(
    {
      customBusinessDate: '2026-07-01 12:30:45',
      customBusinessAmount: '00100.5000'
    },
    {
      dateFields: ['customBusinessDate'],
      numericFields: ['customBusinessAmount']
    }
  );

  const second = canonicalizeRecord(
    {
      customBusinessDate: '2026-07-01T12:30:45.000Z',
      customBusinessAmount: 100.5
    },
    {
      dateFields: ['customBusinessDate'],
      numericFields: ['customBusinessAmount']
    }
  );

  assert.deepEqual(first, second);
});

test('throws a clear error when record is not a plain object', () => {
  assert.throws(
    () => canonicalizeRecord(null),
    /stable hash generator expects record to be a plain object/
  );

  assert.throws(
    () => canonicalizeRecord([]),
    /stable hash generator expects record to be a plain object/
  );
});
