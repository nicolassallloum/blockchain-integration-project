const crypto = require('crypto');
const db = require('../config/database');
const fabricService = require('./fabric.service');

const SERVICE_NAME = 'audit-batch-proof-service';

class AuditBatchProofError extends Error {
  constructor(message, statusCode = 400, code = 'AUDIT_BATCH_PROOF_ERROR') {
    super(message);
    this.name = 'AuditBatchProofError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeText(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();
  return text || fallback;
}

function toPositiveInt(value, fallback = 100, min = 1, max = 1000) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return value.map(stableJson);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableJson(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableJson(value));
}

function sha256Hex(value) {
  return crypto
    .createHash('sha256')
    .update(String(value))
    .digest('hex');
}

function buildLeafHash(row) {
  return sha256Hex(stableStringify({
    type: 'DATA_CHANGE_AUDIT_BATCH_LEAF',
    version: 'v1',
    auditId: String(row.audit_id),
    auditEventHash: normalizeText(row.audit_event_hash)
  }));
}

function buildParentHash(left, right) {
  return sha256Hex(stableStringify({
    type: 'DATA_CHANGE_AUDIT_MERKLE_PARENT',
    version: 'v1',
    left,
    right
  }));
}

function buildMerkleTree(leafHashes) {
  if (!Array.isArray(leafHashes) || leafHashes.length === 0) {
    throw new AuditBatchProofError('At least one audit event is required to build a Merkle batch.');
  }

  const levels = [leafHashes.slice()];

  while (levels[levels.length - 1].length > 1) {
    const current = levels[levels.length - 1];
    const next = [];

    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = current[i + 1] || left;
      next.push(buildParentHash(left, right));
    }

    levels.push(next);
  }

  const proofs = leafHashes.map((_, originalIndex) => {
    let index = originalIndex;
    const proof = [];

    for (let levelIndex = 0; levelIndex < levels.length - 1; levelIndex += 1) {
      const level = levels[levelIndex];
      const isRightNode = index % 2 === 1;
      const siblingIndex = isRightNode ? index - 1 : index + 1;
      const siblingHash = level[siblingIndex] || level[index];

      proof.push({
        position: isRightNode ? 'left' : 'right',
        hash: siblingHash
      });

      index = Math.floor(index / 2);
    }

    return proof;
  });

  return {
    merkleRootHash: levels[levels.length - 1][0],
    levels,
    proofs
  };
}

function verifyMerkleProof(merkleLeafHash, merkleProof, expectedRootHash) {
  let currentHash = normalizeText(merkleLeafHash);
  const proof = Array.isArray(merkleProof) ? merkleProof : [];

  for (const item of proof) {
    const position = normalizeText(item.position).toLowerCase();
    const siblingHash = normalizeText(item.hash);

    if (!siblingHash || !['left', 'right'].includes(position)) {
      return {
        verified: false,
        computedRootHash: currentHash,
        expectedRootHash,
        message: 'Invalid Merkle proof item.'
      };
    }

    currentHash = position === 'left'
      ? buildParentHash(siblingHash, currentHash)
      : buildParentHash(currentHash, siblingHash);
  }

  return {
    verified: currentHash === expectedRootHash,
    computedRootHash: currentHash,
    expectedRootHash,
    message: currentHash === expectedRootHash
      ? 'Audit event verified inside batch Merkle root.'
      : 'Audit event Merkle proof does not match batch root.'
  };
}

function extractTransactionId(fabricResult) {
  if (!fabricResult) {
    return null;
  }

  if (typeof fabricResult === 'string') {
    try {
      return extractTransactionId(JSON.parse(fabricResult));
    } catch {
      return null;
    }
  }

  if (Buffer.isBuffer(fabricResult)) {
    try {
      return extractTransactionId(JSON.parse(fabricResult.toString()));
    } catch {
      return null;
    }
  }

  return (
    fabricResult.transactionId ||
    fabricResult.txId ||
    fabricResult.transactionID ||
    fabricResult.fabricTransactionId ||
    fabricResult.data?.transactionId ||
    fabricResult.data?.txId ||
    fabricResult.data?.transactionID ||
    fabricResult.data?.fabricTransactionId ||
    fabricResult.commitStatus?.transactionId ||
    null
  );
}

function parseFabricData(value) {
  if (!value) {
    return null;
  }

  if (Buffer.isBuffer(value)) {
    return parseFabricData(value.toString());
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

async function getDbClient() {
  if (typeof db.connect === 'function') {
    return db.connect();
  }

  if (typeof db.getClient === 'function') {
    return db.getClient();
  }

  if (db.pool && typeof db.pool.connect === 'function') {
    return db.pool.connect();
  }

  if (typeof db.getPool === 'function') {
    return db.getPool().connect();
  }

  throw new AuditBatchProofError('PostgreSQL client is not available.', 500, 'DB_CLIENT_NOT_AVAILABLE');
}

async function query(sql, params = []) {
  if (typeof db.query === 'function') {
    return db.query(sql, params);
  }

  if (db.pool && typeof db.pool.query === 'function') {
    return db.pool.query(sql, params);
  }

  throw new AuditBatchProofError('PostgreSQL query function is not available.', 500, 'DB_QUERY_NOT_AVAILABLE');
}

function mapBatchRow(row) {
  if (!row) {
    return null;
  }

  return {
    batchId: Number(row.batch_id),
    batchKey: row.batch_key,
    moduleName: row.module_name,
    batchStatus: row.batch_status,
    blockchainStatus: row.blockchain_status,
    verificationStatus: row.verification_status,
    proofType: row.proof_type,
    auditCount: Number(row.audit_count || 0),
    pendingCount: Number(row.pending_count || 0),
    submittedCount: Number(row.submitted_count || 0),
    failedCount: Number(row.failed_count || 0),
    merkleLeafCount: Number(row.merkle_leaf_count || 0),
    batchHash: row.batch_hash,
    merkleRootHash: row.merkle_root_hash,
    hashAlgorithm: row.hash_algorithm,
    hashVersion: row.hash_version,
    blockchainKey: row.blockchain_key,
    blockchainTransactionId: row.blockchain_transaction_id,
    createdBy: row.created_by,
    submittedBy: row.submitted_by,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    submittedAt: row.submitted_at,
    blockchainSubmittedAt: row.blockchain_submitted_at,
    verifiedAt: row.verified_at,
    blockchainError: row.blockchain_error,
    notes: row.notes
  };
}

function mapBatchItemRow(row) {
  return {
    batchItemId: Number(row.batch_item_id),
    batchId: Number(row.batch_id),
    auditId: Number(row.audit_id),
    leafIndex: Number(row.leaf_index),
    auditEventHash: row.audit_event_hash,
    merkleLeafHash: row.merkle_leaf_hash,
    merkleProof: row.merkle_proof || [],
    verificationStatus: row.verification_status,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildBatchKey(prefix = 'AUDIT_BATCH') {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14);

  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();

  return `${prefix}_${timestamp}_${suffix}`;
}

function buildBatchFilter(options = {}) {
  return {
    schemaName: normalizeText(options.schemaName || options.schema_name) || null,
    tableName: normalizeText(options.tableName || options.table_name) || null,
    moduleName: normalizeText(options.moduleName || options.module_name) || null,
    operationType: normalizeText(options.operationType || options.operation_type) || null,
    changedFrom: normalizeText(options.changedFrom || options.changed_from) || null,
    changedTo: normalizeText(options.changedTo || options.changed_to) || null,
    limit: toPositiveInt(options.limit, 100, 1, 1000)
  };
}

async function listCandidateAuditEvents(options = {}) {
  const filter = buildBatchFilter(options);
  const values = [];
  const where = [
    'a.audit_event_hash IS NOT NULL',
    "COALESCE(a.batch_verification_status, 'NOT_BATCHED') = 'NOT_BATCHED'",
    'a.audit_batch_id IS NULL',
    "(a.blockchain_status IS NULL OR a.blockchain_status IN ('PENDING', 'FAILED'))"
  ];

  function addFilter(column, value) {
    if (!value) {
      return;
    }

    values.push(value);
    where.push(`${column} = $${values.length}`);
  }

  addFilter('a.schema_name', filter.schemaName);
  addFilter('a.table_name', filter.tableName);
  addFilter('a.module_name', filter.moduleName);
  addFilter('a.operation_type', filter.operationType);

  if (filter.changedFrom) {
    values.push(filter.changedFrom);
    where.push(`a.changed_at >= $${values.length}::timestamptz`);
  }

  if (filter.changedTo) {
    values.push(filter.changedTo);
    where.push(`a.changed_at <= $${values.length}::timestamptz`);
  }

  values.push(filter.limit);

  const result = await query(
    `
      SELECT
        a.audit_id,
        a.schema_name,
        a.table_name,
        a.module_name,
        a.primary_key_value,
        a.operation_type,
        a.audit_event_hash,
        a.blockchain_key,
        a.blockchain_status,
        a.changed_at
      FROM blockchain.data_change_audit a
      WHERE ${where.join(' AND ')}
      ORDER BY a.changed_at ASC, a.audit_id ASC
      LIMIT $${values.length}
    `,
    values
  );

  return result.rows || [];
}

function prepareBatchProof(candidates, options = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new AuditBatchProofError('No eligible audit events found for batch proof.', 404, 'NO_BATCH_CANDIDATES');
  }

  const batchKey = normalizeText(options.batchKey || options.batch_key, buildBatchKey());
  const leafRows = candidates.map((row, index) => ({
    ...row,
    leafIndex: index,
    merkleLeafHash: buildLeafHash(row)
  }));

  const tree = buildMerkleTree(leafRows.map((row) => row.merkleLeafHash));

  const items = leafRows.map((row, index) => ({
    auditId: Number(row.audit_id),
    leafIndex: index,
    auditEventHash: row.audit_event_hash,
    merkleLeafHash: row.merkleLeafHash,
    merkleProof: tree.proofs[index]
  }));

  const batchHash = sha256Hex(stableStringify({
    type: 'DATA_CHANGE_AUDIT_BATCH_PROOF',
    version: 'v1',
    batchKey,
    merkleRootHash: tree.merkleRootHash,
    auditIds: items.map((item) => item.auditId),
    auditEventHashes: items.map((item) => item.auditEventHash)
  }));

  const modules = [...new Set(candidates.map((row) => row.module_name).filter(Boolean))];

  return {
    batchKey,
    moduleName: modules.length === 1 ? modules[0] : 'MULTI_MODULE',
    batchHash,
    merkleRootHash: tree.merkleRootHash,
    merkleLeafCount: items.length,
    items,
    candidates
  };
}

async function createBatch(options = {}) {
  const dryRun = options.dryRun === true || String(options.dryRun) === 'true';
  const createdBy = normalizeText(options.createdBy || options.created_by || options.user, SERVICE_NAME);
  const notes = normalizeText(options.notes || options.reason, 'Phase 33 audit batch Merkle proof.');
  const filter = buildBatchFilter(options);
  const candidates = await listCandidateAuditEvents(filter);
  const prepared = prepareBatchProof(candidates, options);

  if (dryRun) {
    return {
      created: false,
      dryRun: true,
      message: 'Dry run only. No audit batch was saved.',
      candidateCount: candidates.length,
      batchKey: prepared.batchKey,
      moduleName: prepared.moduleName,
      batchHash: prepared.batchHash,
      merkleRootHash: prepared.merkleRootHash,
      merkleLeafCount: prepared.merkleLeafCount,
      items: prepared.items
    };
  }

  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    const first = candidates[0];
    const last = candidates[candidates.length - 1];

    const batchResult = await client.query(
      `
        INSERT INTO blockchain.data_change_audit_batches (
          batch_key,
          module_name,
          batch_status,
          audit_count,
          pending_count,
          submitted_count,
          failed_count,
          first_audit_id,
          last_audit_id,
          first_changed_at,
          last_changed_at,
          blockchain_key,
          blockchain_status,
          created_by,
          closed_at,
          notes,
          proof_type,
          batch_hash,
          merkle_root_hash,
          merkle_leaf_count,
          hash_algorithm,
          hash_version,
          batch_filter,
          batch_metadata,
          updated_at
        )
        VALUES (
          $1,
          $2,
          'READY_FOR_BLOCKCHAIN',
          $3,
          $3,
          0,
          0,
          $4,
          $5,
          $6,
          $7,
          $8,
          'PENDING',
          $9,
          now(),
          $10,
          'AUDIT_BATCH_MERKLE_ROOT',
          $11,
          $12,
          $13,
          'SHA-256',
          'v1',
          $14::jsonb,
          $15::jsonb,
          now()
        )
        RETURNING *
      `,
      [
        prepared.batchKey,
        prepared.moduleName,
        prepared.items.length,
        first.audit_id,
        last.audit_id,
        first.changed_at,
        last.changed_at,
        `audit_batch_proof:${prepared.batchKey}`,
        createdBy,
        notes,
        prepared.batchHash,
        prepared.merkleRootHash,
        prepared.merkleLeafCount,
        JSON.stringify(filter),
        JSON.stringify({
          sourceSystem: 'postgresql-data-change-audit',
          generatedBy: SERVICE_NAME,
          generatedAt: new Date().toISOString(),
          containsSensitiveData: false,
          onChainPayload: 'proof-only'
        })
      ]
    );

    const batch = batchResult.rows[0];

    for (const item of prepared.items) {
      await client.query(
        `
          INSERT INTO blockchain.data_change_audit_batch_items (
            batch_id,
            audit_id,
            leaf_index,
            audit_event_hash,
            merkle_leaf_hash,
            merkle_proof,
            verification_status
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'NOT_VERIFIED')
        `,
        [
          batch.batch_id,
          item.auditId,
          item.leafIndex,
          item.auditEventHash,
          item.merkleLeafHash,
          JSON.stringify(item.merkleProof)
        ]
      );

      await client.query(
        `
          UPDATE blockchain.data_change_audit
          SET
            audit_batch_id = $1,
            batch_merkle_root_hash = $2,
            batch_merkle_leaf_hash = $3,
            batch_merkle_proof = $4::jsonb,
            batch_verification_status = 'BATCHED',
            batch_proof_checked_at = now()
          WHERE audit_id = $5
        `,
        [
          batch.batch_id,
          prepared.merkleRootHash,
          item.merkleLeafHash,
          JSON.stringify(item.merkleProof),
          item.auditId
        ]
      );
    }

    await client.query(
      `
        UPDATE blockchain.data_change_blockchain_outbox
        SET
          audit_batch_id = $1,
          proof_mode = 'BATCH_ITEM',
          batch_key = $2,
          batch_merkle_root_hash = $3,
          batch_hash = $4
        WHERE audit_id = ANY($5::bigint[])
      `,
      [
        batch.batch_id,
        prepared.batchKey,
        prepared.merkleRootHash,
        prepared.batchHash,
        prepared.items.map((item) => item.auditId)
      ]
    );

    await client.query('COMMIT');

    return {
      created: true,
      dryRun: false,
      message: 'Audit batch Merkle proof created successfully.',
      batch: mapBatchRow(batch),
      itemCount: prepared.items.length,
      items: prepared.items
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (typeof client.release === 'function') {
      client.release();
    }
  }
}

async function listBatches(options = {}) {
  const values = [];
  const where = ['1 = 1'];
  const limit = toPositiveInt(options.limit, 50, 1, 500);

  function addFilter(column, value) {
    const text = normalizeText(value);

    if (!text || text === 'ALL') {
      return;
    }

    values.push(text);
    where.push(`${column} = $${values.length}`);
  }

  addFilter('batch_status', options.batchStatus || options.batch_status);
  addFilter('blockchain_status', options.blockchainStatus || options.blockchain_status);
  addFilter('verification_status', options.verificationStatus || options.verification_status);
  addFilter('module_name', options.moduleName || options.module_name);

  values.push(limit);

  const result = await query(
    `
      SELECT *
      FROM blockchain.data_change_audit_batches
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC, batch_id DESC
      LIMIT $${values.length}
    `,
    values
  );

  return (result.rows || []).map(mapBatchRow);
}

async function getBatchRow(batchIdOrKey) {
  const key = normalizeText(batchIdOrKey);

  if (!key) {
    throw new AuditBatchProofError('batchIdOrKey is required.');
  }

  const result = await query(
    `
      SELECT *
      FROM blockchain.data_change_audit_batches
      WHERE batch_id::text = $1
         OR batch_key = $1
         OR blockchain_key = $1
      LIMIT 1
    `,
    [key]
  );

  if (!result.rows[0]) {
    throw new AuditBatchProofError(`Audit batch not found: ${key}`, 404, 'AUDIT_BATCH_NOT_FOUND');
  }

  return result.rows[0];
}

async function getBatchItems(batchIdOrKey) {
  const batch = await getBatchRow(batchIdOrKey);

  const result = await query(
    `
      SELECT *
      FROM blockchain.data_change_audit_batch_items
      WHERE batch_id = $1
      ORDER BY leaf_index ASC
    `,
    [batch.batch_id]
  );

  return {
    batch: mapBatchRow(batch),
    items: (result.rows || []).map(mapBatchItemRow)
  };
}

function buildBatchProofPayload(batch) {
  return {
    batchId: batch.batch_key,
    batchHash: batch.batch_hash,
    merkleRootHash: batch.merkle_root_hash
  };
}

async function submitBatch(batchIdOrKey, options = {}) {
  const dryRun = options.dryRun === true || String(options.dryRun) === 'true';
  const submittedBy = normalizeText(options.submittedBy || options.submitted_by || options.user, SERVICE_NAME);
  const batch = await getBatchRow(batchIdOrKey);

  if (!batch.batch_hash || !batch.merkle_root_hash) {
    throw new AuditBatchProofError('Batch hash and Merkle root are required before blockchain submission.');
  }

  const payload = buildBatchProofPayload(batch);

  if (dryRun) {
    return {
      submitted: false,
      dryRun: true,
      message: 'Dry run only. No Fabric transaction submitted.',
      batch: mapBatchRow(batch),
      chaincode: {
        functionName: 'SaveAuditBatchProof',
        args: [JSON.stringify(payload)]
      },
      proofPayload: payload
    };
  }

  try {
    const fabricResult = await fabricService.submitTransaction(
      'SaveAuditBatchProof',
      [JSON.stringify(payload)],
      {
        requestId: options.requestId,
        sourceSystem: 'BLOCKCHAIN_API',
        requestSource: 'AUDIT_BATCH_PROOF_API',
        createdBy: submittedBy
      }
    );

    const transactionId = extractTransactionId(fabricResult);

    await query(
      `
        UPDATE blockchain.data_change_audit_batches
        SET
          batch_status = 'SUBMITTED',
          blockchain_status = 'SUBMITTED',
          blockchain_transaction_id = $2,
          submitted_by = $3,
          submitted_at = now(),
          blockchain_submitted_at = now(),
          blockchain_error = NULL,
          updated_at = now()
        WHERE batch_id = $1
      `,
      [batch.batch_id, transactionId, submittedBy]
    );

    await query(
      `
        UPDATE blockchain.data_change_audit
        SET
          blockchain_status = 'BATCH_SUBMITTED',
          blockchain_transaction_id = COALESCE(blockchain_transaction_id, $2),
          blockchain_submitted_at = COALESCE(blockchain_submitted_at, now()),
          batch_blockchain_transaction_id = $2,
          batch_blockchain_submitted_at = now(),
          blockchain_error = NULL
        WHERE audit_batch_id = $1
      `,
      [batch.batch_id, transactionId]
    );

    await query(
      `
        UPDATE blockchain.data_change_blockchain_outbox
        SET
          status = 'SUBMITTED',
          blockchain_transaction_id = COALESCE(blockchain_transaction_id, $2),
          submitted_at = COALESCE(submitted_at, now()),
          batch_blockchain_transaction_id = $2,
          batch_blockchain_submitted_at = now(),
          last_error = NULL,
          locked_at = NULL,
          locked_by = NULL,
          proof_mode = 'BATCH_ITEM',
          batch_key = COALESCE(batch_key, $3),
          batch_merkle_root_hash = COALESCE(batch_merkle_root_hash, $4),
          batch_hash = COALESCE(batch_hash, $5)
        WHERE audit_batch_id = $1
      `,
      [
        batch.batch_id,
        transactionId,
        batch.batch_key,
        batch.merkle_root_hash,
        batch.batch_hash
      ]
    );

    return {
      submitted: true,
      dryRun: false,
      message: 'Audit batch proof submitted to Fabric successfully.',
      batchId: Number(batch.batch_id),
      batchKey: batch.batch_key,
      blockchainKey: batch.blockchain_key,
      batchHash: batch.batch_hash,
      merkleRootHash: batch.merkle_root_hash,
      transactionId,
      fabric: {
        channelName: fabricResult.channelName,
        chaincodeName: fabricResult.chaincodeName,
        functionName: fabricResult.functionName,
        durationMs: fabricResult.durationMs,
        data: fabricResult.data
      }
    };
  } catch (error) {
    await query(
      `
        UPDATE blockchain.data_change_audit_batches
        SET
          blockchain_status = 'FAILED',
          blockchain_error = $2,
          updated_at = now()
        WHERE batch_id = $1
      `,
      [batch.batch_id, String(error.message || error).slice(0, 2000)]
    );

    throw error;
  }
}

async function getFabricBatchProof(batchIdOrKey) {
  const batch = await getBatchRow(batchIdOrKey);

  const fabricResult = await fabricService.evaluateTransaction(
    'GetAuditBatchProof',
    [batch.batch_key],
    {
      sourceSystem: 'BLOCKCHAIN_API',
      requestSource: 'AUDIT_BATCH_PROOF_API',
      createdBy: SERVICE_NAME
    }
  );

  return {
    batch: mapBatchRow(batch),
    fabric: {
      channelName: fabricResult.channelName,
      chaincodeName: fabricResult.chaincodeName,
      functionName: fabricResult.functionName,
      durationMs: fabricResult.durationMs
    },
    proof: parseFabricData(fabricResult.data)
  };
}

async function verifyBatchProof(batchIdOrKey, options = {}) {
  const batch = await getBatchRow(batchIdOrKey);
  const batchHash = normalizeText(options.batchHash || options.batch_hash, batch.batch_hash);

  if (!batchHash) {
    throw new AuditBatchProofError('batchHash is required for batch proof verification.');
  }

  const fabricResult = await fabricService.evaluateTransaction(
    'VerifyAuditBatchProof',
    [batch.batch_key, batchHash],
    {
      sourceSystem: 'BLOCKCHAIN_API',
      requestSource: 'AUDIT_BATCH_PROOF_API',
      createdBy: SERVICE_NAME
    }
  );

  const verification = parseFabricData(fabricResult.data);
  const verified = verification?.verified === true || verification?.status === 'VERIFIED';
  const status = verified ? 'VERIFIED' : 'MISMATCH';

  await query(
    `
      UPDATE blockchain.data_change_audit_batches
      SET
        verification_status = $2,
        verified_at = now(),
        updated_at = now()
      WHERE batch_id = $1
    `,
    [batch.batch_id, status]
  );

  return {
    batch: mapBatchRow(batch),
    batchHash,
    fabric: {
      channelName: fabricResult.channelName,
      chaincodeName: fabricResult.chaincodeName,
      functionName: fabricResult.functionName,
      durationMs: fabricResult.durationMs
    },
    verification
  };
}

async function verifyAuditEventInsideBatch(batchIdOrKey, auditId) {
  const batch = await getBatchRow(batchIdOrKey);
  const auditIdText = normalizeText(auditId);

  if (!auditIdText) {
    throw new AuditBatchProofError('auditId is required.');
  }

  const result = await query(
    `
      SELECT *
      FROM blockchain.data_change_audit_batch_items
      WHERE batch_id = $1
        AND audit_id = $2::bigint
      LIMIT 1
    `,
    [batch.batch_id, auditIdText]
  );

  const item = result.rows[0];

  if (!item) {
    throw new AuditBatchProofError(
      `Audit event ${auditIdText} is not part of batch ${batch.batch_key}.`,
      404,
      'AUDIT_EVENT_NOT_IN_BATCH'
    );
  }

  const verification = verifyMerkleProof(
    item.merkle_leaf_hash,
    item.merkle_proof,
    batch.merkle_root_hash
  );

  const status = verification.verified ? 'VERIFIED' : 'MISMATCH';

  await query(
    `
      UPDATE blockchain.data_change_audit_batch_items
      SET
        verification_status = $3,
        verified_at = now(),
        updated_at = now()
      WHERE batch_id = $1
        AND audit_id = $2
    `,
    [batch.batch_id, item.audit_id, status]
  );

  await query(
    `
      UPDATE blockchain.data_change_audit
      SET
        batch_verification_status = $3,
        batch_verified_at = now(),
        batch_proof_checked_at = now()
      WHERE audit_batch_id = $1
        AND audit_id = $2
    `,
    [batch.batch_id, item.audit_id, status]
  );

  return {
    batch: mapBatchRow(batch),
    item: mapBatchItemRow(item),
    verificationStatus: status,
    verification
  };
}

async function getSummary() {
  const result = await query(`
    SELECT
      COUNT(*)::int AS total_batches,
      COUNT(*) FILTER (WHERE blockchain_status = 'PENDING')::int AS pending_batches,
      COUNT(*) FILTER (WHERE blockchain_status = 'SUBMITTED')::int AS submitted_batches,
      COUNT(*) FILTER (WHERE blockchain_status = 'FAILED')::int AS failed_batches,
      COUNT(*) FILTER (WHERE verification_status = 'VERIFIED')::int AS verified_batches,
      COUNT(*) FILTER (WHERE verification_status IN ('MISMATCH', 'TAMPERED', 'FAILED'))::int AS invalid_batches,
      COALESCE(SUM(audit_count), 0)::int AS total_audit_events_in_batches,
      MAX(created_at) AS latest_batch_created_at,
      MAX(blockchain_submitted_at) AS latest_batch_submitted_at
    FROM blockchain.data_change_audit_batches
  `);

  return result.rows[0];
}

module.exports = {
  SERVICE_NAME,
  AuditBatchProofError,
  stableStringify,
  sha256Hex,
  buildLeafHash,
  buildMerkleTree,
  verifyMerkleProof,
  listCandidateAuditEvents,
  createBatch,
  listBatches,
  getBatchItems,
  submitBatch,
  getFabricBatchProof,
  verifyBatchProof,
  verifyAuditEventInsideBatch,
  getSummary
};
