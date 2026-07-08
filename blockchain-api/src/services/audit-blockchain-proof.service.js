const crypto = require('crypto');
const db = require('../config/database');
const fabricService = require('./fabric.service');

const SERVICE_NAME = 'audit-blockchain-proof-service';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

class AuditBlockchainProofError extends Error {
  constructor(message, statusCode = 400, code = 'AUDIT_BLOCKCHAIN_PROOF_ERROR') {
    super(message);
    this.name = 'AuditBlockchainProofError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeText(value, fallback = null) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const normalized = String(value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || fallback;
}

function normalizeInteger(value, fallback = DEFAULT_LIMIT) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 1) {
    return fallback;
  }

  return Math.min(numberValue, MAX_LIMIT);
}

function stableStringify(value) {
  if (value === undefined || value === null) {
    return '';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function sha256Hex(value) {
  const normalized = typeof value === 'string' ? value : stableStringify(value);

  if (!normalized) {
    return undefined;
  }

  return crypto
    .createHash('sha256')
    .update(normalized)
    .digest('hex');
}

function extractTransactionId(fabricResult) {
  if (!fabricResult) {
    return null;
  }

  if (typeof fabricResult === 'string') {
    try {
      return extractTransactionId(JSON.parse(fabricResult));
    } catch (_) {
      return null;
    }
  }

  if (Buffer.isBuffer(fabricResult)) {
    try {
      return extractTransactionId(JSON.parse(fabricResult.toString()));
    } catch (_) {
      return null;
    }
  }

  if (typeof fabricResult === 'object') {
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

  return null;
}

function mapOutboxRow(row) {
  if (!row) {
    return null;
  }

  return {
    outboxId: Number(row.outbox_id),
    auditId: Number(row.audit_id),
    blockchainKey: row.blockchain_key,
    auditEventHash: row.audit_event_hash,
    moduleName: row.module_name,
    schemaName: row.schema_name,
    tableName: row.table_name,
    primaryKeyValue: row.primary_key_value,
    operationType: row.operation_type,
    status: row.status,
    retryCount: Number(row.retry_count || 0),
    lastError: row.last_error,
    blockchainTransactionId: row.blockchain_transaction_id,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    nextRetryAt: row.next_retry_at,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    audit: {
      oldRowHash: row.old_row_hash,
      newRowHash: row.new_row_hash,
      primaryKeyJson: row.primary_key_json,
      changedFields: row.changed_fields,
      changedByAppUser: row.changed_by_app_user,
      changedByDbUser: row.changed_by_db_user,
      changedByRole: row.changed_by_role,
      clientIp: row.client_ip,
      clientHostname: row.client_hostname,
      changedAt: row.changed_at,
      postgresTransactionId: row.postgres_transaction_id,
      validationStatus: row.validation_status,
      approvalStatus: row.approval_status,
      complianceStatus: row.compliance_status
    }
  };
}

function buildAuditEventProofPayload(row) {
  if (!row) {
    throw new AuditBlockchainProofError('Audit outbox row is required');
  }

  if (!row.audit_event_hash) {
    throw new AuditBlockchainProofError('audit_event_hash is required');
  }

  if (!row.blockchain_key) {
    throw new AuditBlockchainProofError('blockchain_key is required');
  }

  return {
    auditId: String(row.audit_id),
    blockchainKey: normalizeText(row.blockchain_key),
    auditEventHash: normalizeText(row.audit_event_hash),
    oldRowHash: normalizeText(row.old_row_hash),
    newRowHash: normalizeText(row.new_row_hash),
    schemaHash: sha256Hex(row.schema_name),
    tableHash: sha256Hex(row.table_name),
    primaryKeyHash: sha256Hex(row.primary_key_json || row.primary_key_value),
    changedFieldsHash: sha256Hex(row.changed_fields),
    actorHash: sha256Hex(
      normalizeText(row.changed_by_app_user) ||
      normalizeText(row.changed_by_db_user) ||
      normalizeText(row.changed_by_role)
    ),
    clientIpHash: sha256Hex(row.client_ip),
    clientHostnameHash: sha256Hex(row.client_hostname),
    operationType: normalizeText(row.operation_type),
    hashAlgorithm: 'SHA-256',
    hashVersion: 'v1',
    proofVersion: 'phase-29-audit-event-backend-proof-v1',
    sourceSystem: 'postgresql-data-change-audit',
    generatedAt: row.changed_at ? new Date(row.changed_at).toISOString() : undefined,
    submittedBy: SERVICE_NAME
  };
}

async function getSummary() {
  const result = await db.query(`
    SELECT
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_count,
      COUNT(*) FILTER (WHERE status = 'SUBMITTING')::int AS submitting_count,
      COUNT(*) FILTER (WHERE status = 'SUBMITTED')::int AS submitted_count,
      COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed_count,
      MIN(created_at) FILTER (WHERE status = 'PENDING') AS oldest_pending_at,
      MAX(submitted_at) FILTER (WHERE status = 'SUBMITTED') AS latest_submitted_at
    FROM blockchain.data_change_blockchain_outbox
  `);

  return result.rows[0];
}

async function listOutbox(options = {}) {
  const status = normalizeText(options.status || 'PENDING');
  const limit = normalizeInteger(options.limit);

  const result = await db.query(
    `
      SELECT
        o.outbox_id,
        o.audit_id,
        o.blockchain_key,
        o.audit_event_hash,
        o.module_name,
        o.schema_name,
        o.table_name,
        o.primary_key_value,
        o.operation_type,
        o.status,
        o.retry_count,
        o.last_error,
        o.blockchain_transaction_id,
        o.created_at,
        o.submitted_at,
        o.next_retry_at,
        o.locked_at,
        o.locked_by,
        a.old_row_hash,
        a.new_row_hash,
        a.primary_key_json,
        a.changed_fields,
        a.changed_by_app_user,
        a.changed_by_db_user,
        a.changed_by_role,
        a.client_ip,
        a.client_hostname,
        a.changed_at,
        a.postgres_transaction_id,
        a.validation_status,
        a.approval_status,
        a.compliance_status
      FROM blockchain.data_change_blockchain_outbox o
      JOIN blockchain.data_change_audit a ON a.audit_id = o.audit_id
      WHERE ($1::text IS NULL OR o.status = $1)
      ORDER BY o.created_at ASC, o.outbox_id ASC
      LIMIT $2
    `,
    [status === 'ALL' ? null : status, limit]
  );

  return result.rows.map(mapOutboxRow);
}

async function getOutboxRow(outboxId) {
  const normalizedOutboxId = Number(outboxId);

  if (!Number.isInteger(normalizedOutboxId) || normalizedOutboxId < 1) {
    throw new AuditBlockchainProofError('Valid outboxId is required');
  }

  const result = await db.query(
    `
      SELECT
        o.outbox_id,
        o.audit_id,
        o.blockchain_key,
        o.audit_event_hash,
        o.module_name,
        o.schema_name,
        o.table_name,
        o.primary_key_value,
        o.operation_type,
        o.status,
        o.retry_count,
        o.last_error,
        o.blockchain_transaction_id,
        o.created_at,
        o.submitted_at,
        o.next_retry_at,
        o.locked_at,
        o.locked_by,
        a.old_row_hash,
        a.new_row_hash,
        a.primary_key_json,
        a.changed_fields,
        a.changed_by_app_user,
        a.changed_by_db_user,
        a.changed_by_role,
        a.client_ip,
        a.client_hostname,
        a.changed_at,
        a.postgres_transaction_id,
        a.validation_status,
        a.approval_status,
        a.compliance_status
      FROM blockchain.data_change_blockchain_outbox o
      JOIN blockchain.data_change_audit a ON a.audit_id = o.audit_id
      WHERE o.outbox_id = $1
      LIMIT 1
    `,
    [normalizedOutboxId]
  );

  if (result.rows.length === 0) {
    throw new AuditBlockchainProofError(
      `Audit blockchain outbox row not found: ${normalizedOutboxId}`,
      404,
      'AUDIT_OUTBOX_NOT_FOUND'
    );
  }

  return result.rows[0];
}

async function claimNextOutboxRow(workerName = SERVICE_NAME) {
  const result = await db.query(
    `
      UPDATE blockchain.data_change_blockchain_outbox o
      SET
        status = 'SUBMITTING',
        locked_at = now(),
        locked_by = $1,
        last_error = NULL
      WHERE o.outbox_id = (
        SELECT outbox_id
        FROM blockchain.data_change_blockchain_outbox
        WHERE status IN ('PENDING', 'FAILED')
          AND (next_retry_at IS NULL OR next_retry_at <= now())
        ORDER BY created_at ASC, outbox_id ASC
        LIMIT 1
      )
      RETURNING o.outbox_id
    `,
    [workerName]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return getOutboxRow(result.rows[0].outbox_id);
}

async function markOutboxSubmitting(outboxId, workerName = SERVICE_NAME) {
  await db.query(
    `
      UPDATE blockchain.data_change_blockchain_outbox
      SET
        status = 'SUBMITTING',
        locked_at = now(),
        locked_by = $2,
        last_error = NULL
      WHERE outbox_id = $1
    `,
    [outboxId, workerName]
  );
}

async function markOutboxSubmitted(row, transactionId) {
  const txId = normalizeText(transactionId);

  await db.query(
    `
      UPDATE blockchain.data_change_blockchain_outbox
      SET
        status = 'SUBMITTED',
        blockchain_transaction_id = $2,
        submitted_at = now(),
        last_error = NULL,
        locked_at = NULL,
        locked_by = NULL
      WHERE outbox_id = $1
    `,
    [row.outbox_id, txId]
  );

  await db.query(
    `
      UPDATE blockchain.data_change_audit
      SET
        blockchain_status = 'SUBMITTED',
        blockchain_transaction_id = $2,
        blockchain_submitted_at = now(),
        blockchain_error = NULL
      WHERE audit_id = $1
    `,
    [row.audit_id, txId]
  );
}

async function markOutboxFailed(row, error) {
  const message = String(error.message || error).slice(0, 2000);

  await db.query(
    `
      UPDATE blockchain.data_change_blockchain_outbox
      SET
        status = 'FAILED',
        retry_count = retry_count + 1,
        last_error = $2,
        next_retry_at = now() + (
          LEAST(3600, GREATEST(60, POWER(2, LEAST(retry_count + 1, 10))::int * 60))
          * INTERVAL '1 second'
        ),
        locked_at = NULL,
        locked_by = NULL
      WHERE outbox_id = $1
    `,
    [row.outbox_id, message]
  );

  await db.query(
    `
      UPDATE blockchain.data_change_audit
      SET
        blockchain_status = 'FAILED',
        blockchain_error = $2
      WHERE audit_id = $1
    `,
    [row.audit_id, message]
  );
}

async function submitOutboxById(outboxId, options = {}) {
  const dryRun = options.dryRun === true || String(options.dryRun) === 'true';
  const workerName = normalizeText(options.workerName, SERVICE_NAME);
  const row = await getOutboxRow(outboxId);
  const payload = buildAuditEventProofPayload(row);

  if (dryRun) {
    return {
      submitted: false,
      dryRun: true,
      message: 'Dry run only. No Fabric transaction submitted.',
      outbox: mapOutboxRow(row),
      chaincode: {
        functionName: 'SaveAuditEventProof',
        args: [JSON.stringify(payload)]
      },
      proofPayload: payload
    };
  }

  await markOutboxSubmitting(row.outbox_id, workerName);

  try {
    const fabricResult = await fabricService.submitTransaction(
      'SaveAuditEventProof',
      [JSON.stringify(payload)],
      {
        requestId: options.requestId,
        sourceSystem: 'BLOCKCHAIN_API',
        requestSource: 'AUDIT_BLOCKCHAIN_PROOF_WORKER',
        createdBy: workerName
      }
    );

    const transactionId = extractTransactionId(fabricResult);
    await markOutboxSubmitted(row, transactionId);

    return {
      submitted: true,
      dryRun: false,
      message: 'Audit event proof submitted to Fabric successfully.',
      outboxId: Number(row.outbox_id),
      auditId: Number(row.audit_id),
      blockchainKey: row.blockchain_key,
      auditEventHash: row.audit_event_hash,
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
    await markOutboxFailed(row, error);
    throw error;
  }
}

async function submitNext(options = {}) {
  const dryRun = options.dryRun === true || String(options.dryRun) === 'true';
  const workerName = normalizeText(options.workerName, SERVICE_NAME);

  const row = dryRun
    ? (await listOutbox({ status: 'PENDING', limit: 1 }))[0]
    : await claimNextOutboxRow(workerName);

  if (!row) {
    return {
      submitted: false,
      dryRun,
      message: 'No eligible audit outbox rows found.'
    };
  }

  const outboxId = row.outbox_id || row.outboxId;
  return submitOutboxById(outboxId, {
    ...options,
    dryRun,
    workerName
  });
}

async function getAuditEventProof(auditIdOrBlockchainKey) {
  const key = normalizeText(auditIdOrBlockchainKey);

  if (!key) {
    throw new AuditBlockchainProofError('auditIdOrBlockchainKey is required');
  }

  const fabricResult = await fabricService.evaluateTransaction(
    'GetAuditEventProof',
    [key],
    {
      sourceSystem: 'BLOCKCHAIN_API',
      requestSource: 'AUDIT_BLOCKCHAIN_PROOF_API',
      createdBy: SERVICE_NAME
    }
  );

  return {
    key,
    fabric: {
      channelName: fabricResult.channelName,
      chaincodeName: fabricResult.chaincodeName,
      functionName: fabricResult.functionName,
      durationMs: fabricResult.durationMs
    },
    proof: fabricResult.data
  };
}

async function verifyAuditEventProof(input = {}) {
  const key = normalizeText(input.auditIdOrBlockchainKey || input.blockchainKey || input.auditId);
  const auditEventHash = normalizeText(input.auditEventHash || input.audit_event_hash);

  if (!key) {
    throw new AuditBlockchainProofError('auditIdOrBlockchainKey, blockchainKey, or auditId is required');
  }

  if (!auditEventHash) {
    throw new AuditBlockchainProofError('auditEventHash is required');
  }

  const fabricResult = await fabricService.evaluateTransaction(
    'VerifyAuditEventProof',
    [key, auditEventHash],
    {
      sourceSystem: 'BLOCKCHAIN_API',
      requestSource: 'AUDIT_BLOCKCHAIN_PROOF_API',
      createdBy: SERVICE_NAME
    }
  );

  return {
    key,
    auditEventHash,
    fabric: {
      channelName: fabricResult.channelName,
      chaincodeName: fabricResult.chaincodeName,
      functionName: fabricResult.functionName,
      durationMs: fabricResult.durationMs
    },
    verification: fabricResult.data
  };
}

module.exports = {
  SERVICE_NAME,
  AuditBlockchainProofError,
  buildAuditEventProofPayload,
  getSummary,
  listOutbox,
  getOutboxRow,
  submitOutboxById,
  submitNext,
  getAuditEventProof,
  verifyAuditEventProof
};
