'use strict';

const assert = require('assert');
const KycWalletContract = require('../lib/kycWalletContract');

class MockIterator {
  constructor(items) {
    this.items = items;
    this.index = 0;
  }

  async next() {
    if (this.index >= this.items.length) {
      return { done: true };
    }

    return {
      value: this.items[this.index++],
      done: false
    };
  }

  async close() {}
}

class MockStub {
  constructor() {
    this.state = new Map();
    this.txId = 'phase28-test-tx';
  }

  async putState(key, value) {
    this.state.set(key, Buffer.from(value));
  }

  async getState(key) {
    return this.state.get(key) || Buffer.alloc(0);
  }

  createCompositeKey(objectType, attributes) {
    return `${objectType}\u0000${attributes.map(String).join('\u0000')}\u0000`;
  }

  splitCompositeKey(key) {
    const parts = String(key).split('\u0000').filter(Boolean);

    return {
      objectType: parts[0],
      attributes: parts.slice(1)
    };
  }

  async getStateByPartialCompositeKey(objectType, attributes = []) {
    const fullPrefix = this.createCompositeKey(objectType, attributes);
    const prefix = attributes.length === 0
      ? `${objectType}\u0000`
      : fullPrefix;

    const items = Array.from(this.state.keys())
      .filter((key) => key.startsWith(prefix))
      .sort()
      .map((key) => ({
        key,
        value: this.state.get(key)
      }));

    return new MockIterator(items);
  }

  getTxID() {
    return this.txId;
  }

  getTxTimestamp() {
    return {
      seconds: {
        low: 1783500000
      },
      nanos: 0
    };
  }
}

function createContext() {
  return {
    stub: new MockStub()
  };
}

async function run() {
  const contract = new KycWalletContract();
  const ctx = createContext();

  const auditHash = 'a'.repeat(64);
  const mismatchedHash = 'b'.repeat(64);

  const savedAuditProof = JSON.parse(
    await contract.SaveAuditEventProof(
      ctx,
      JSON.stringify({
        auditId: '1001',
        auditEventHash: auditHash,
        oldRowHash: 'c'.repeat(64),
        newRowHash: 'd'.repeat(64),
        tableHash: 'e'.repeat(64),
        primaryKeyHash: 'f'.repeat(64),
        changedFieldsHash: '1'.repeat(64),
        actorHash: '2'.repeat(64),
        clientIpHash: '3'.repeat(64),
        requestIdHash: '4'.repeat(64),
        operationType: 'UPDATE',
        generatedAt: '2026-07-08T10:00:00.000Z',
        submittedBy: 'phase28-test'
      })
    )
  );

  assert.equal(savedAuditProof.docType, 'AUDIT_EVENT_PROOF');
  assert.equal(savedAuditProof.auditId, '1001');
  assert.equal(savedAuditProof.auditEventHash, auditHash);
  assert.equal(savedAuditProof.blockchainKey, 'audit_event_proof:1001');

  const fetchedAuditProof = JSON.parse(
    await contract.GetAuditEventProof(ctx, '1001')
  );

  assert.equal(fetchedAuditProof.auditEventHash, auditHash);

  const verifiedAuditProof = JSON.parse(
    await contract.VerifyAuditEventProof(ctx, '1001', auditHash)
  );

  assert.equal(verifiedAuditProof.status, 'VERIFIED');
  assert.equal(verifiedAuditProof.verified, true);

  const mismatchedAuditProof = JSON.parse(
    await contract.VerifyAuditEventProof(ctx, '1001', mismatchedHash)
  );

  assert.equal(mismatchedAuditProof.status, 'MISMATCH');
  assert.equal(mismatchedAuditProof.verified, false);

  const queriedAuditProofs = JSON.parse(
    await contract.QueryAuditEventProofs(
      ctx,
      JSON.stringify({
        auditEventHash: auditHash,
        limit: 10
      })
    )
  );

  assert.equal(queriedAuditProofs.length, 1);
  assert.equal(queriedAuditProofs[0].auditId, '1001');

  await assert.rejects(
    () =>
      contract.SaveAuditEventProof(
        ctx,
        JSON.stringify({
          auditId: '1002',
          auditEventHash: auditHash,
          oldRow: {
            customerName: 'Must stay off-chain'
          }
        })
      ),
    /Field not allowed|Nested object not allowed/
  );

  await assert.rejects(
    () =>
      contract.SaveAuditEventProof(
        ctx,
        JSON.stringify({
          auditId: '1001',
          auditEventHash: auditHash
        })
      ),
    /already exists/
  );

  const batchHash = '5'.repeat(64);

  const savedBatchProof = JSON.parse(
    await contract.SaveAuditBatchProof(
      ctx,
      JSON.stringify({
        batchId: 'BATCH-001',
        batchHash,
        merkleRootHash: '6'.repeat(64),
        auditEventCount: 1,
        firstAuditId: '1001',
        lastAuditId: '1001',
        generatedAt: '2026-07-08T10:05:00.000Z'
      })
    )
  );

  assert.equal(savedBatchProof.docType, 'AUDIT_BATCH_PROOF');
  assert.equal(savedBatchProof.batchId, 'BATCH-001');
  assert.equal(savedBatchProof.batchHash, batchHash);
  assert.equal(savedBatchProof.blockchainKey, 'audit_batch_proof:BATCH-001');

  const fetchedBatchProof = JSON.parse(
    await contract.GetAuditBatchProof(ctx, 'BATCH-001')
  );

  assert.equal(fetchedBatchProof.batchHash, batchHash);

  const verifiedBatchProof = JSON.parse(
    await contract.VerifyAuditBatchProof(ctx, 'BATCH-001', batchHash)
  );

  assert.equal(verifiedBatchProof.status, 'VERIFIED');
  assert.equal(verifiedBatchProof.verified, true);

  const missingAuditProof = JSON.parse(
    await contract.VerifyAuditEventProof(ctx, '9999', auditHash)
  );

  assert.equal(missingAuditProof.status, 'NOT_FOUND');
  assert.equal(missingAuditProof.verified, false);

  console.log('Phase 28 audit event and batch proof chaincode tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
