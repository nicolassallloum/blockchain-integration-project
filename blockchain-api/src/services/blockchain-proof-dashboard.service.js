'use strict';

/**
 * Step 24 — Blockchain Proof Dashboard APIs
 *
 * PostgreSQL remains the source of truth.
 * Blockchain stores proof only.
 *
 * These dashboard APIs return aggregated proof-safe operational metrics.
 * They do not return raw source rows, customer PII, AML SQL, screening payload,
 * transaction payload, tokens, passwords, or secrets.
 */

const BLOCKCHAIN_SCHEMA = 'blockchain';
const HISTORY_TABLE = 'blockchain_sync_history';
const RUNS_TABLE = 'blockchain_sync_runs';
const VERIFICATION_TABLE = 'blockchain_verification_logs';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

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

function normalizeRecordType(value) {
  if (!value || String(value).trim().toUpperCase() === 'ALL') {
    return null;
  }

  return String(value).trim().toUpperCase();
}

function parseMetadata(metadata) {
  if (!metadata) {
    return {};
  }

  if (typeof metadata === 'object') {
    return metadata;
  }

  try {
    return JSON.parse(metadata);
  } catch (error) {
    return {};
  }
}

function safeMetadataSummary(metadata) {
  const parsed = parseMetadata(metadata);

  return {
    integrationStep: parsed.integrationStep || null,
    proofOnly: parsed.proofOnly === true,
    retryMechanism: parsed.retryMechanism === true || Boolean(parsed.retryMechanism),
    fakeBlockchainSuccess: parsed.fakeBlockchainSuccess === true,
    rawSourceRowExcluded: parsed.rawSourceRowExcluded === true,
    sensitiveFieldsExcluded: parsed.sensitiveFieldsExcluded === true,
    blockchainVerificationStatus: parsed.blockchainVerificationStatus || null,
    correctedBy: parsed.correctedBy || null
  };
}

function safeHistoryRow(row) {
  return {
    historyId: String(row.history_id),
    runId: row.run_id,
    recordType: row.record_type,
    sourceRecordId: row.source_record_id,
    actionType: row.action_type,
    syncStatus: row.sync_status,
    verificationStatus: row.verification_status,
    hasBlockchainTransaction: Boolean(row.blockchain_transaction_id),
    blockchainTransactionId: row.blockchain_transaction_id || null,
    blockchainKey: row.blockchain_key || null,
    retryCount: Number(row.retry_count || 0),
    lastRetryAt: row.last_retry_at,
    submittedBy: row.submitted_by,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadataSummary: safeMetadataSummary(row.metadata)
  };
}

function safeRunRow(row) {
  return {
    runId: row.run_id,
    runType: row.run_type,
    recordType: row.record_type,
    sourceViewName: row.source_view_name,
    status: row.status,
    totalSourceRecords: Number(row.total_source_records || 0),
    totalCreateRecords: Number(row.total_create_records || 0),
    totalUpdateRecords: Number(row.total_update_records || 0),
    totalUnchangedRecords: Number(row.total_unchanged_records || 0),
    totalFailedRecords: Number(row.total_failed_records || 0),
    triggeredBy: row.triggered_by,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    metadataSummary: safeMetadataSummary(row.metadata)
  };
}

function safeVerificationLogRow(row) {
  return {
    verificationId: String(row.verification_id),
    historyId: String(row.history_id),
    recordType: row.record_type,
    sourceRecordId: row.source_record_id,
    verificationStatus: row.verification_status,
    hasBlockchainTransaction: Boolean(row.blockchain_transaction_id),
    blockchainTransactionId: row.blockchain_transaction_id || null,
    blockchainKey: row.blockchain_key || null,
    verifiedBy: row.verified_by,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    metadataSummary: safeMetadataSummary(row.metadata)
  };
}

async function getDashboardHealth() {
  const query = resolveQueryClient();

  const tablesResult = await query(
    `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_name = ANY($2::text[])
    ORDER BY table_name
    `,
    [
      BLOCKCHAIN_SCHEMA,
      [HISTORY_TABLE, RUNS_TABLE, VERIFICATION_TABLE]
    ]
  );

  const foundTables = tablesResult.rows.map((row) => row.table_name);
  const requiredTables = [HISTORY_TABLE, RUNS_TABLE, VERIFICATION_TABLE];
  const missingTables = requiredTables.filter((tableName) => !foundTables.includes(tableName));

  return {
    status: missingTables.length ? 'DEGRADED' : 'UP',
    dashboardReady: missingTables.length === 0,
    requiredTables,
    foundTables,
    missingTables,
    securityPolicy: {
      rawRowsReturned: false,
      sensitiveFieldsReturned: false,
      proofOnlyMetrics: true,
      fakeBlockchainSuccessAllowed: false
    },
    timestamp: new Date().toISOString()
  };
}

async function getDashboardSummary() {
  const query = resolveQueryClient();

  const historySummaryResult = await query(
    `
    SELECT
      COUNT(*)::int AS total_history_rows,
      COUNT(*) FILTER (WHERE action_type = 'CREATE')::int AS create_rows,
      COUNT(*) FILTER (WHERE action_type = 'UPDATE')::int AS update_rows,
      COUNT(*) FILTER (WHERE blockchain_transaction_id IS NOT NULL)::int AS rows_with_blockchain_tx,
      COUNT(*) FILTER (WHERE blockchain_transaction_id IS NULL)::int AS rows_without_blockchain_tx,
      COUNT(*) FILTER (WHERE COALESCE(retry_count, 0) > 0)::int AS rows_with_retry,
      COALESCE(SUM(COALESCE(retry_count, 0)), 0)::int AS total_retry_attempts,
      COUNT(*) FILTER (WHERE sync_status = 'PENDING')::int AS pending_sync_rows,
      COUNT(*) FILTER (WHERE sync_status IN ('FAILED', 'ERROR'))::int AS failed_sync_rows,
      COUNT(*) FILTER (WHERE verification_status IN ('VERIFIED', 'SUCCESS', 'PASSED', 'MATCHED'))::int AS verified_rows,
      COUNT(*) FILTER (WHERE verification_status IN ('FAILED', 'MISMATCHED', 'TAMPERED'))::int AS failed_or_not_verified_rows
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    `
  );

  const runSummaryResult = await query(
    `
    SELECT
      COUNT(*)::int AS total_runs,
      COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed_runs,
      COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed_runs,
      COUNT(*) FILTER (WHERE status = 'RUNNING')::int AS running_runs,
      MAX(created_at) AS latest_run_created_at
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, RUNS_TABLE)}
    `
  );

  const verificationSummaryResult = await query(
    `
    SELECT
      COUNT(*)::int AS total_verification_logs,
      COUNT(*) FILTER (
        WHERE blockchain_transaction_id IS NULL
          AND verification_status IN ('VERIFIED', 'SUCCESS', 'PASSED', 'MATCHED')
      )::int AS fake_verified_rows,
      COUNT(*) FILTER (
        WHERE metadata ->> 'fakeBlockchainSuccess' = 'true'
      )::int AS fake_blockchain_success_metadata_rows,
      MAX(created_at) AS latest_verification_log_at
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, VERIFICATION_TABLE)}
    `
  );

  const recordTypeBreakdown = await getRecordTypeBreakdown();
  const syncStatusBreakdown = await getSyncStatusBreakdown();
  const verificationStatusBreakdown = await getVerificationStatusBreakdown();
  const retrySummary = await getRetrySummary();

  return {
    asOf: new Date().toISOString(),
    history: historySummaryResult.rows[0],
    runs: runSummaryResult.rows[0],
    verification: verificationSummaryResult.rows[0],
    recordTypeBreakdown,
    syncStatusBreakdown,
    verificationStatusBreakdown,
    retrySummary,
    securityPolicy: {
      rawRowsReturned: false,
      sensitiveFieldsReturned: false,
      proofOnlyMetrics: true,
      fakeBlockchainSuccessAllowed: false
    }
  };
}

async function getRecordTypeBreakdown() {
  const query = resolveQueryClient();

  const result = await query(
    `
    SELECT
      record_type,
      COUNT(*)::int AS total_rows,
      COUNT(*) FILTER (WHERE action_type = 'CREATE')::int AS create_rows,
      COUNT(*) FILTER (WHERE action_type = 'UPDATE')::int AS update_rows,
      COUNT(*) FILTER (WHERE blockchain_transaction_id IS NOT NULL)::int AS rows_with_blockchain_tx,
      COUNT(*) FILTER (WHERE blockchain_transaction_id IS NULL)::int AS rows_without_blockchain_tx,
      COUNT(*) FILTER (WHERE COALESCE(retry_count, 0) > 0)::int AS rows_with_retry,
      COALESCE(SUM(COALESCE(retry_count, 0)), 0)::int AS total_retry_attempts,
      COUNT(*) FILTER (WHERE sync_status = 'PENDING')::int AS pending_rows,
      COUNT(*) FILTER (WHERE verification_status IN ('VERIFIED', 'SUCCESS', 'PASSED', 'MATCHED'))::int AS verified_rows,
      COUNT(*) FILTER (WHERE verification_status IN ('FAILED', 'MISMATCHED', 'TAMPERED'))::int AS failed_or_not_verified_rows
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    GROUP BY record_type
    ORDER BY record_type
    `
  );

  return result.rows;
}

async function getSyncStatusBreakdown() {
  const query = resolveQueryClient();

  const result = await query(
    `
    SELECT
      sync_status,
      COUNT(*)::int AS total_rows,
      COUNT(*) FILTER (WHERE blockchain_transaction_id IS NOT NULL)::int AS rows_with_blockchain_tx,
      COUNT(*) FILTER (WHERE blockchain_transaction_id IS NULL)::int AS rows_without_blockchain_tx
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    GROUP BY sync_status
    ORDER BY sync_status
    `
  );

  return result.rows;
}

async function getVerificationStatusBreakdown() {
  const query = resolveQueryClient();

  const result = await query(
    `
    SELECT
      verification_status,
      COUNT(*)::int AS total_rows,
      COUNT(*) FILTER (WHERE blockchain_transaction_id IS NOT NULL)::int AS rows_with_blockchain_tx,
      COUNT(*) FILTER (WHERE blockchain_transaction_id IS NULL)::int AS rows_without_blockchain_tx
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    GROUP BY verification_status
    ORDER BY verification_status
    `
  );

  return result.rows;
}

async function getRetrySummary() {
  const query = resolveQueryClient();

  const byRecordTypeResult = await query(
    `
    SELECT
      record_type,
      COUNT(*)::int AS total_rows,
      COUNT(*) FILTER (WHERE COALESCE(retry_count, 0) > 0)::int AS rows_with_retry,
      COALESCE(SUM(COALESCE(retry_count, 0)), 0)::int AS total_retry_attempts,
      MIN(COALESCE(retry_count, 0))::int AS min_retry_count,
      MAX(COALESCE(retry_count, 0))::int AS max_retry_count,
      MAX(last_retry_at) AS latest_retry_at
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    GROUP BY record_type
    ORDER BY record_type
    `
  );

  const topRetriedResult = await query(
    `
    SELECT
      history_id,
      record_type,
      source_record_id,
      sync_status,
      verification_status,
      blockchain_key,
      blockchain_transaction_id,
      retry_count,
      last_retry_at,
      submitted_by,
      metadata,
      created_at,
      updated_at
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    WHERE COALESCE(retry_count, 0) > 0
    ORDER BY retry_count DESC, last_retry_at DESC NULLS LAST, history_id DESC
    LIMIT 10
    `
  );

  return {
    byRecordType: byRecordTypeResult.rows,
    topRetriedRows: topRetriedResult.rows.map(safeHistoryRow)
  };
}

async function getLatestRuns(options = {}) {
  const query = resolveQueryClient();
  const limit = normalizeLimit(options.limit);
  const recordType = normalizeRecordType(options.recordType);

  const result = await query(
    `
    SELECT
      run_id,
      run_type,
      record_type,
      source_view_name,
      status,
      total_source_records,
      total_create_records,
      total_update_records,
      total_unchanged_records,
      total_failed_records,
      triggered_by,
      error_message,
      started_at,
      finished_at,
      metadata,
      created_at,
      updated_at
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, RUNS_TABLE)}
    WHERE ($1::text IS NULL OR record_type = $1 OR record_type = 'ALL')
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [recordType, limit]
  );

  return {
    recordType: recordType || 'ALL',
    limit,
    totalRows: result.rows.length,
    rows: result.rows.map(safeRunRow)
  };
}

async function getLatestHistory(options = {}) {
  const query = resolveQueryClient();
  const limit = normalizeLimit(options.limit);
  const recordType = normalizeRecordType(options.recordType);

  const result = await query(
    `
    SELECT
      history_id,
      run_id,
      record_type,
      source_record_id,
      action_type,
      sync_status,
      verification_status,
      blockchain_key,
      blockchain_transaction_id,
      retry_count,
      last_retry_at,
      submitted_by,
      error_message,
      metadata,
      created_at,
      updated_at
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    WHERE ($1::text IS NULL OR record_type = $1)
    ORDER BY created_at DESC, history_id DESC
    LIMIT $2
    `,
    [recordType, limit]
  );

  return {
    recordType: recordType || 'ALL',
    limit,
    totalRows: result.rows.length,
    rows: result.rows.map(safeHistoryRow)
  };
}

async function getLatestVerificationLogs(options = {}) {
  const query = resolveQueryClient();
  const limit = normalizeLimit(options.limit);
  const recordType = normalizeRecordType(options.recordType);

  const result = await query(
    `
    SELECT
      verification_id,
      history_id,
      record_type,
      source_record_id,
      blockchain_key,
      blockchain_transaction_id,
      verification_status,
      verified_by,
      error_message,
      metadata,
      created_at
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, VERIFICATION_TABLE)}
    WHERE ($1::text IS NULL OR record_type = $1)
    ORDER BY created_at DESC, verification_id DESC
    LIMIT $2
    `,
    [recordType, limit]
  );

  return {
    recordType: recordType || 'ALL',
    limit,
    totalRows: result.rows.length,
    rows: result.rows.map(safeVerificationLogRow)
  };
}

async function getDashboardFull(options = {}) {
  const limit = normalizeLimit(options.limit || 10);

  const [
    health,
    summary,
    latestRuns,
    latestHistory,
    latestVerificationLogs
  ] = await Promise.all([
    getDashboardHealth(),
    getDashboardSummary(),
    getLatestRuns({ limit }),
    getLatestHistory({ limit }),
    getLatestVerificationLogs({ limit })
  ]);

  return {
    health,
    summary,
    latestRuns,
    latestHistory,
    latestVerificationLogs
  };
}

module.exports = {
  getDashboardHealth,
  getDashboardSummary,
  getRecordTypeBreakdown,
  getSyncStatusBreakdown,
  getVerificationStatusBreakdown,
  getRetrySummary,
  getLatestRuns,
  getLatestHistory,
  getLatestVerificationLogs,
  getDashboardFull
};
