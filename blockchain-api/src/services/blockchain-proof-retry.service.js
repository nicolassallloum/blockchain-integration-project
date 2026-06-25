'use strict';

/**
 * Step 22 — Blockchain Proof Retry Mechanism
 *
 * PostgreSQL remains the source of truth.
 * Blockchain stores proof only.
 *
 * This retry service:
 * - Selects retryable proof history rows.
 * - Increments retry_count.
 * - Updates last_retry_at.
 * - Optionally calls a configured proof-only submit endpoint.
 * - Never fakes blockchain success.
 * - Never exposes or stores raw source records.
 */

const crypto = require('crypto');
const http = require('http');
const https = require('https');

const BLOCKCHAIN_SCHEMA = 'blockchain';
const HISTORY_TABLE = 'blockchain_sync_history';
const RUNS_TABLE = 'blockchain_sync_runs';

const HASH_ALGORITHM = 'SHA-256';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 500;
const DEFAULT_MAX_RETRIES = 3;

const SUBMIT_ENDPOINT =
  process.env.BLOCKCHAIN_PROOF_RETRY_SUBMIT_URL ||
  process.env.BLOCKCHAIN_PROOF_SUBMIT_URL ||
  null;

let queryClient = null;

function resolveQueryClient() {
  if (queryClient) {
    return queryClient;
  }

  const candidates = [
    '../config/database',
    '../config/db',
    '../config/postgres',
    '../database',
    '../db'
  ];

  for (const modulePath of candidates) {
    try {
      const dbModule = require(modulePath);

      if (dbModule && typeof dbModule.query === 'function') {
        queryClient = dbModule.query.bind(dbModule);
        return queryClient;
      }

      if (dbModule && dbModule.pool && typeof dbModule.pool.query === 'function') {
        queryClient = dbModule.pool.query.bind(dbModule.pool);
        return queryClient;
      }

      if (dbModule && dbModule.default && typeof dbModule.default.query === 'function') {
        queryClient = dbModule.default.query.bind(dbModule.default);
        return queryClient;
      }
    } catch (error) {
      // Continue checking existing database modules.
    }
  }

  throw new Error(
    'Unable to resolve PostgreSQL query client. Please confirm backend database config export.'
  );
}

function quoteIdent(identifier) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

function quoteTable(schemaName, tableName) {
  return `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;
}

function normalizeLimit(value, defaultValue = DEFAULT_LIMIT, maxValue = MAX_LIMIT) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.min(parsed, maxValue);
}

function normalizeMaxRetries(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_RETRIES;
  }

  return Math.min(parsed, 20);
}

function normalizeDryRun(value) {
  if (value === undefined || value === null || value === '') {
    return true;
  }

  return String(value).toLowerCase() !== 'false';
}

function normalizeRecordType(value) {
  if (!value || String(value).trim().toUpperCase() === 'ALL') {
    return null;
  }

  return String(value).trim().toUpperCase();
}

function safeJson(value) {
  return JSON.stringify(value || {});
}

function truncateError(value) {
  if (!value) {
    return null;
  }

  return String(value).slice(0, 2000);
}

async function getTableColumns(tableName) {
  const query = resolveQueryClient();

  const result = await query(
    `
    SELECT
      column_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
    ORDER BY ordinal_position
    `,
    [BLOCKCHAIN_SCHEMA, tableName]
  );

  return result.rows;
}

function getColumnNames(columnRows) {
  return columnRows.map((row) => row.column_name);
}

function extractAllowedValuesFromConstraint(definition) {
  if (!definition || typeof definition !== 'string') {
    return [];
  }

  const values = [];
  const regex = /'([^']+)'/g;
  let match;

  while ((match = regex.exec(definition)) !== null) {
    if (match[1] && !values.includes(match[1])) {
      values.push(match[1]);
    }
  }

  return values;
}

async function getAllowedCheckValues(tableName, columnName) {
  const query = resolveQueryClient();

  const result = await query(
    `
    SELECT
      conname,
      pg_get_constraintdef(c.oid) AS constraint_definition
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = $1
      AND t.relname = $2
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%' || $3 || '%'
    ORDER BY conname
    `,
    [BLOCKCHAIN_SCHEMA, tableName, columnName]
  );

  const values = [];

  for (const row of result.rows) {
    const extracted = extractAllowedValuesFromConstraint(row.constraint_definition);

    for (const value of extracted) {
      if (!values.includes(value)) {
        values.push(value);
      }
    }
  }

  return values;
}

async function resolveRunTypeValue() {
  const allowedValues = await getAllowedCheckValues(RUNS_TABLE, 'run_type');

  if (!allowedValues.length) {
    return 'MANUAL';
  }

  const preferredValues = [
    'RETRY',
    'MANUAL',
    'SCHEDULED',
    'VERIFY'
  ];

  for (const preferredValue of preferredValues) {
    if (allowedValues.includes(preferredValue)) {
      return preferredValue;
    }
  }

  return allowedValues[0];
}

async function resolveRetryableSyncStatuses() {
  const allowedValues = await getAllowedCheckValues(HISTORY_TABLE, 'sync_status');

  if (!allowedValues.length) {
    return ['PENDING'];
  }

  const preferredValues = [
    'FAILED',
    'ERROR',
    'RETRY',
    'PENDING_RETRY',
    'PENDING',
    'NEW',
    'READY',
    'QUEUED',
    'NOT_SUBMITTED',
    'PENDING_SUBMISSION',
    'PENDING_BLOCKCHAIN',
    'PENDING_BLOCKCHAIN_SUBMISSION'
  ];

  const retryable = preferredValues.filter((value) => allowedValues.includes(value));

  return retryable.length ? retryable : allowedValues;
}

async function resolveSubmittedSyncStatusValue(currentStatus) {
  const allowedValues = await getAllowedCheckValues(HISTORY_TABLE, 'sync_status');

  if (!allowedValues.length) {
    return currentStatus;
  }

  const preferredValues = [
    'SUBMITTED',
    'SYNCED',
    'COMPLETED',
    'SUCCESS'
  ];

  for (const preferredValue of preferredValues) {
    if (allowedValues.includes(preferredValue)) {
      return preferredValue;
    }
  }

  return currentStatus;
}

function extractBlockchainTransactionId(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const directKeys = [
    'blockchainTransactionId',
    'blockchain_transaction_id',
    'transactionId',
    'transaction_id',
    'txId',
    'tx_id',
    'fabricTransactionId',
    'fabric_transaction_id'
  ];

  for (const key of directKeys) {
    if (payload[key]) {
      return String(payload[key]);
    }
  }

  for (const value of Object.values(payload)) {
    if (value && typeof value === 'object') {
      const nested = extractBlockchainTransactionId(value);

      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function httpPostJson(url, payload) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const body = JSON.stringify(payload);

    const request = client.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 45000
      },
      (response) => {
        let responseBody = '';

        response.setEncoding('utf8');

        response.on('data', (chunk) => {
          responseBody += chunk;
        });

        response.on('end', () => {
          let json = null;

          try {
            json = responseBody ? JSON.parse(responseBody) : {};
          } catch (error) {
            return reject(
              new Error(`Submit endpoint returned invalid JSON: ${error.message}`)
            );
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            return reject(
              new Error(
                `Submit endpoint failed with HTTP ${response.statusCode}: ${json.message || responseBody}`
              )
            );
          }

          return resolve(json);
        });
      }
    );

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy(new Error('Submit endpoint request timed out.'));
    });

    request.write(body);
    request.end();
  });
}

function safeCandidate(row) {
  return {
    historyId: String(row.history_id),
    recordType: row.record_type,
    sourceRecordId: row.source_record_id,
    stableHash: row.new_hash,
    hashAlgorithm: row.hash_algorithm || HASH_ALGORITHM,
    blockchainKey: row.blockchain_key,
    blockchainTransactionId: row.blockchain_transaction_id,
    syncStatus: row.sync_status,
    verificationStatus: row.verification_status,
    retryCount: Number(row.retry_count || 0),
    lastRetryAt: row.last_retry_at,
    submittedBy: row.submitted_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getRetryHealth() {
  const query = resolveQueryClient();
  const retryableStatuses = await resolveRetryableSyncStatuses();

  const result = await query(
    `
    SELECT
      record_type,
      sync_status,
      verification_status,
      COUNT(*)::int AS total_rows,
      MIN(COALESCE(retry_count, 0))::int AS min_retry_count,
      MAX(COALESCE(retry_count, 0))::int AS max_retry_count
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    WHERE blockchain_transaction_id IS NULL
      AND sync_status = ANY($1::text[])
    GROUP BY record_type, sync_status, verification_status
    ORDER BY record_type, sync_status, verification_status
    `,
    [retryableStatuses]
  );

  const totalRetryableRows = result.rows.reduce(
    (sum, row) => sum + Number(row.total_rows || 0),
    0
  );

  return {
    status: 'UP',
    retryTable: `${BLOCKCHAIN_SCHEMA}.${HISTORY_TABLE}`,
    runTable: `${BLOCKCHAIN_SCHEMA}.${RUNS_TABLE}`,
    retryableStatuses,
    totalRetryableRows,
    submitEndpointConfigured: Boolean(SUBMIT_ENDPOINT),
    submitEndpointPolicy: SUBMIT_ENDPOINT
      ? 'Proof-only payload will be submitted to configured endpoint.'
      : 'No submit endpoint configured. Retry attempts will be recorded only; blockchain success will not be faked.',
    rowsByRecordType: result.rows,
    securityPolicy: {
      rawRowsReturned: false,
      sensitiveFieldsReturned: false,
      proofOnlyPayload: true,
      fakeBlockchainSuccess: false
    }
  };
}

async function getRetryCandidates(options = {}) {
  const query = resolveQueryClient();

  const recordType = normalizeRecordType(options.recordType);
  const limit = normalizeLimit(options.limit);
  const maxRetries = normalizeMaxRetries(options.maxRetries);
  const retryableStatuses = await resolveRetryableSyncStatuses();

  const result = await query(
    `
    SELECT
      history_id,
      record_type,
      source_record_id,
      old_hash,
      new_hash,
      hash_algorithm,
      blockchain_key,
      blockchain_transaction_id,
      sync_status,
      verification_status,
      COALESCE(retry_count, 0)::int AS retry_count,
      last_retry_at,
      submitted_by,
      created_at,
      updated_at
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    WHERE blockchain_transaction_id IS NULL
      AND sync_status = ANY($1::text[])
      AND COALESCE(retry_count, 0) < $2
      AND ($3::text IS NULL OR record_type = $3)
    ORDER BY
      CASE WHEN last_retry_at IS NULL THEN 0 ELSE 1 END,
      last_retry_at ASC NULLS FIRST,
      created_at ASC,
      history_id ASC
    LIMIT $4
    `,
    [retryableStatuses, maxRetries, recordType, limit]
  );

  return {
    recordType: recordType || 'ALL',
    limit,
    maxRetries,
    retryableStatuses,
    totalCandidates: result.rows.length,
    submitEndpointConfigured: Boolean(SUBMIT_ENDPOINT),
    candidates: result.rows.map(safeCandidate)
  };
}

async function createRetryRun(runId, submittedBy, recordType) {
  const query = resolveQueryClient();
  const columnRows = await getTableColumns(RUNS_TABLE);
  const columns = getColumnNames(columnRows);
  const now = new Date();
  const runTypeValue = await resolveRunTypeValue();

  const valuesByColumn = {
    run_id: runId,
    run_type: runTypeValue,
    record_type: recordType || 'ALL',
    source_view_name: HISTORY_TABLE,
    started_at: now,
    finished_at: null,
    status: 'RUNNING',
    total_source_records: 0,
    total_create_records: 0,
    total_update_records: 0,
    total_unchanged_records: 0,
    total_failed_records: 0,
    triggered_by: submittedBy,
    error_message: null,
    metadata: safeJson({
      integrationStep: 'STEP_22_RETRY_MECHANISM',
      retryMechanism: true,
      proofOnly: true,
      fakeBlockchainSuccess: false,
      submitEndpointConfigured: Boolean(SUBMIT_ENDPOINT)
    }),
    created_at: now,
    updated_at: now
  };

  const insertColumns = columns.filter(
    (columnName) => valuesByColumn[columnName] !== undefined
  );

  const params = insertColumns.map((columnName) => valuesByColumn[columnName]);
  const placeholders = insertColumns.map((_, index) => `$${index + 1}`);

  await query(
    `
    INSERT INTO ${quoteTable(BLOCKCHAIN_SCHEMA, RUNS_TABLE)}
      (${insertColumns.map(quoteIdent).join(', ')})
    VALUES
      (${placeholders.join(', ')})
    `,
    params
  );

  return {
    runId,
    table: `${BLOCKCHAIN_SCHEMA}.${RUNS_TABLE}`
  };
}

async function updateRetryRun(runId, summary) {
  const query = resolveQueryClient();
  const columnRows = await getTableColumns(RUNS_TABLE);
  const columns = getColumnNames(columnRows);
  const now = new Date();

  const valuesByColumn = {
    finished_at: now,
    status: 'COMPLETED',
    total_source_records: summary.scannedCandidates,
    total_create_records: 0,
    total_update_records: summary.recordedRetryAttempts,
    total_unchanged_records: summary.skippedCandidates,
    total_failed_records: summary.failedRetryAttempts,
    error_message: summary.failedRetryAttempts > 0
      ? `${summary.failedRetryAttempts} retry attempt(s) failed.`
      : null,
    metadata: safeJson({
      integrationStep: 'STEP_22_RETRY_MECHANISM',
      retryMechanism: true,
      proofOnly: true,
      fakeBlockchainSuccess: false,
      submitEndpointConfigured: Boolean(SUBMIT_ENDPOINT),
      summary
    }),
    updated_at: now
  };

  const updateColumns = columns.filter(
    (columnName) =>
      columnName !== 'run_id' &&
      valuesByColumn[columnName] !== undefined
  );

  const params = updateColumns.map((columnName) => valuesByColumn[columnName]);
  params.push(runId);

  const setClause = updateColumns
    .map((columnName, index) => `${quoteIdent(columnName)} = $${index + 1}`)
    .join(', ');

  await query(
    `
    UPDATE ${quoteTable(BLOCKCHAIN_SCHEMA, RUNS_TABLE)}
    SET ${setClause}
    WHERE run_id = $${params.length}
    `,
    params
  );

  return {
    runId,
    table: `${BLOCKCHAIN_SCHEMA}.${RUNS_TABLE}`
  };
}

async function markRetryRunFailed(runId, error) {
  const query = resolveQueryClient();
  const columnRows = await getTableColumns(RUNS_TABLE);
  const columns = getColumnNames(columnRows);
  const now = new Date();

  const valuesByColumn = {
    finished_at: now,
    status: 'FAILED',
    total_failed_records: 1,
    error_message: truncateError(error.message),
    updated_at: now
  };

  const updateColumns = columns.filter(
    (columnName) =>
      columnName !== 'run_id' &&
      valuesByColumn[columnName] !== undefined
  );

  const params = updateColumns.map((columnName) => valuesByColumn[columnName]);
  params.push(runId);

  const setClause = updateColumns
    .map((columnName, index) => `${quoteIdent(columnName)} = $${index + 1}`)
    .join(', ');

  await query(
    `
    UPDATE ${quoteTable(BLOCKCHAIN_SCHEMA, RUNS_TABLE)}
    SET ${setClause}
    WHERE run_id = $${params.length}
    `,
    params
  );

  return {
    runId,
    table: `${BLOCKCHAIN_SCHEMA}.${RUNS_TABLE}`
  };
}

async function recordRetryAttempt(candidate, submittedBy, outcome) {
  const query = resolveQueryClient();

  const metadataPatch = {
    retryMechanism: {
      integrationStep: 'STEP_22_RETRY_MECHANISM',
      lastOutcome: outcome.status,
      lastRetryBy: submittedBy,
      lastRetryAt: new Date().toISOString(),
      submitEndpointConfigured: Boolean(SUBMIT_ENDPOINT),
      fakeBlockchainSuccess: false
    }
  };

  await query(
    `
    UPDATE ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    SET
      retry_count = COALESCE(retry_count, 0) + 1,
      last_retry_at = NOW(),
      submitted_by = $2,
      metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
      updated_at = NOW()
    WHERE history_id = $1::bigint
    `,
    [
      candidate.historyId,
      submittedBy,
      safeJson(metadataPatch)
    ]
  );
}

async function linkBlockchainTransaction(candidate, blockchainTransactionId) {
  const query = resolveQueryClient();
  const submittedSyncStatus = await resolveSubmittedSyncStatusValue(candidate.syncStatus);

  await query(
    `
    UPDATE ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    SET
      blockchain_transaction_id = $2,
      blockchain_submitted_at = NOW(),
      sync_status = $3,
      error_message = NULL,
      metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
      updated_at = NOW()
    WHERE history_id = $1::bigint
    `,
    [
      candidate.historyId,
      blockchainTransactionId,
      submittedSyncStatus,
      safeJson({
        retryMechanism: {
          integrationStep: 'STEP_22_RETRY_MECHANISM',
          lastOutcome: 'SUBMITTED_TO_BLOCKCHAIN',
          linkedBlockchainTransactionId: blockchainTransactionId,
          fakeBlockchainSuccess: false
        }
      })
    ]
  );
}

async function recordRetryFailure(candidate, error) {
  const query = resolveQueryClient();

  await query(
    `
    UPDATE ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    SET
      error_message = $2,
      metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
      updated_at = NOW()
    WHERE history_id = $1::bigint
    `,
    [
      candidate.historyId,
      truncateError(error.message),
      safeJson({
        retryMechanism: {
          integrationStep: 'STEP_22_RETRY_MECHANISM',
          lastOutcome: 'RETRY_FAILED',
          fakeBlockchainSuccess: false
        }
      })
    ]
  );
}

async function submitProofOnlyPayload(candidate, submittedBy) {
  if (!SUBMIT_ENDPOINT) {
    return {
      status: 'RECORDED_NO_SUBMIT_ENDPOINT',
      blockchainTransactionId: null,
      message: 'No submit endpoint configured. Retry attempt recorded only.'
    };
  }

  const proofOnlyPayload = {
    historyId: candidate.historyId,
    recordType: candidate.recordType,
    sourceRecordId: candidate.sourceRecordId,
    stableHash: candidate.stableHash,
    hashAlgorithm: candidate.hashAlgorithm || HASH_ALGORITHM,
    blockchainKey: candidate.blockchainKey,
    retryAttempt: Number(candidate.retryCount || 0) + 1,
    submittedBy,
    proofOnly: true
  };

  const response = await httpPostJson(SUBMIT_ENDPOINT, proofOnlyPayload);
  const blockchainTransactionId = extractBlockchainTransactionId(response);

  if (!blockchainTransactionId) {
    throw new Error(
      'Submit endpoint completed but did not return a blockchain transaction ID.'
    );
  }

  return {
    status: 'SUBMITTED_TO_BLOCKCHAIN',
    blockchainTransactionId,
    message: 'Proof-only payload submitted successfully.'
  };
}

async function runRetry(options = {}) {
  const recordType = normalizeRecordType(options.recordType);
  const limit = normalizeLimit(options.limit);
  const maxRetries = normalizeMaxRetries(options.maxRetries);
  const dryRun = normalizeDryRun(options.dryRun);
  const submittedBy = options.submittedBy || 'STEP_22_RETRY_API';

  const candidateResult = await getRetryCandidates({
    recordType,
    limit,
    maxRetries
  });

  const summary = {
    dryRun,
    recordType: recordType || 'ALL',
    limit,
    maxRetries,
    scannedCandidates: candidateResult.totalCandidates,
    recordedRetryAttempts: 0,
    blockchainTransactionLinkedCount: 0,
    recordedNoSubmitEndpointCount: 0,
    failedRetryAttempts: 0,
    skippedCandidates: 0,
    submitEndpointConfigured: Boolean(SUBMIT_ENDPOINT)
  };

  if (dryRun) {
    return {
      ...summary,
      runId: null,
      results: candidateResult.candidates.map((candidate) => ({
        ...candidate,
        retryDecision: 'WOULD_RETRY'
      }))
    };
  }

  const runId = crypto.randomUUID();
  const results = [];

  await createRetryRun(runId, submittedBy, recordType || 'ALL');

  try {
    for (const candidate of candidateResult.candidates) {
      try {
        const outcome = await submitProofOnlyPayload(candidate, submittedBy);

        await recordRetryAttempt(candidate, submittedBy, outcome);

        summary.recordedRetryAttempts += 1;

        if (outcome.status === 'RECORDED_NO_SUBMIT_ENDPOINT') {
          summary.recordedNoSubmitEndpointCount += 1;
        }

        if (outcome.blockchainTransactionId) {
          await linkBlockchainTransaction(candidate, outcome.blockchainTransactionId);
          summary.blockchainTransactionLinkedCount += 1;
        }

        results.push({
          historyId: candidate.historyId,
          recordType: candidate.recordType,
          sourceRecordId: candidate.sourceRecordId,
          blockchainKey: candidate.blockchainKey,
          outcome
        });
      } catch (error) {
        summary.failedRetryAttempts += 1;

        await recordRetryFailure(candidate, error);

        results.push({
          historyId: candidate.historyId,
          recordType: candidate.recordType,
          sourceRecordId: candidate.sourceRecordId,
          blockchainKey: candidate.blockchainKey,
          outcome: {
            status: 'RETRY_FAILED',
            blockchainTransactionId: null,
            message: error.message
          }
        });
      }
    }

    await updateRetryRun(runId, summary);

    return {
      ...summary,
      runId,
      results
    };
  } catch (error) {
    await markRetryRunFailed(runId, error);
    throw error;
  }
}

module.exports = {
  getRetryHealth,
  getRetryCandidates,
  runRetry
};
