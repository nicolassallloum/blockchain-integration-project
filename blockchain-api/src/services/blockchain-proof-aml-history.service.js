'use strict';

/**
 * Step 18 — Implement AML History First
 *
 * PostgreSQL remains the source of truth.
 * Blockchain stores proof only.
 *
 * This service creates PostgreSQL history rows for AML proof records.
 *
 * It must not store:
 * - rule_sql_query
 * - rule_message
 * - raw PostgreSQL row
 * - PII
 * - tokens
 * - passwords
 * - secrets
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');

const BLOCKCHAIN_SCHEMA = 'blockchain';
const AML_SOURCE_VIEW = 'valoores_aml_rules_sync';
const HISTORY_TABLE = 'blockchain_sync_history';
const RUNS_TABLE = 'blockchain_sync_runs';

const RECORD_TYPE = 'AML';
const HASH_ALGORITHM = 'SHA-256';
const BLOCKCHAIN_KEY_VERSION = 'V1';

const DEFAULT_LIMIT = 48;
const MAX_LIMIT = 1000;

const INTERNAL_API_BASE_URL =
  process.env.BLOCKCHAIN_PROOF_API_INTERNAL_BASE_URL ||
  'http://127.0.0.1:3001/api/v1/blockchain-proof/api';

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

function normalizeDryRun(value) {
  if (value === undefined || value === null || value === '') {
    return true;
  }

  return String(value).toLowerCase() !== 'false';
}

function buildSourceRecordId(ruleId, ruleQueryId) {
  return `${String(ruleId)}::${String(ruleQueryId)}`;
}

function buildBlockchainKey(sourceRecordId, stableHash) {
  return `BCPROOF::${BLOCKCHAIN_KEY_VERSION}::${RECORD_TYPE}::${sourceRecordId}::${stableHash.substring(0, 16)}`;
}

function safeJson(value) {
  return JSON.stringify(value || {});
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const request = client.get(parsedUrl, (response) => {
      let body = '';

      response.setEncoding('utf8');

      response.on('data', (chunk) => {
        body += chunk;
      });

      response.on('end', () => {
        try {
          const json = JSON.parse(body);

          if (response.statusCode < 200 || response.statusCode >= 300) {
            return reject(
              new Error(
                `Internal API returned ${response.statusCode}: ${json.message || body}`
              )
            );
          }

          return resolve(json);
        } catch (error) {
          return reject(
            new Error(`Unable to parse internal API JSON response: ${error.message}`)
          );
        }
      });
    });

    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy(new Error('Internal API request timed out.'));
    });
  });
}

function findStableHash(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const directKeys = [
    'stableHash',
    'stable_hash',
    'hash',
    'recordHash',
    'record_hash',
    'newHash',
    'new_hash'
  ];

  for (const key of directKeys) {
    if (
      typeof payload[key] === 'string' &&
      /^[a-f0-9]{64}$/i.test(payload[key])
    ) {
      return payload[key].toLowerCase();
    }
  }

  for (const value of Object.values(payload)) {
    if (value && typeof value === 'object') {
      const nested = findStableHash(value);

      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

async function getStableHashFromExistingApi(ruleId, ruleQueryId) {
  const url =
    `${INTERNAL_API_BASE_URL}/records/AML/hash` +
    `?rule_id=${encodeURIComponent(String(ruleId))}` +
    `&rule_query_id=${encodeURIComponent(String(ruleQueryId))}`;

  const response = await httpGetJson(url);

  if (!response.success) {
    throw new Error(response.message || 'Stable hash API returned success=false.');
  }

  const stableHash = findStableHash(response);

  if (!stableHash) {
    throw new Error('Stable hash was not found in existing hash API response.');
  }

  return stableHash;
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
    return 'HISTORY_SYNC';
  }

  const preferredValues = [
    'HISTORY_SYNC',
    'FULL_SYNC',
    'MANUAL_SYNC',
    'CREATE_DETECTION',
    'UPDATE_DETECTION',
    'BLOCKCHAIN_PROOF_SYNC',
    'PROOF_SYNC',
    'AML',
    'AML_SYNC'
  ];

  for (const preferredValue of preferredValues) {
    if (allowedValues.includes(preferredValue)) {
      return preferredValue;
    }
  }

  return allowedValues[0];
}

async function getAmlSourceCount() {
  const query = resolveQueryClient();

  const result = await query(
    `
    SELECT COUNT(*)::int AS total
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, AML_SOURCE_VIEW)}
    `
  );

  return {
    recordType: RECORD_TYPE,
    sourceView: `${BLOCKCHAIN_SCHEMA}.${AML_SOURCE_VIEW}`,
    totalSourceRecords: result.rows[0] ? result.rows[0].total : 0
  };
}

async function getAmlSourceKeys(limit = DEFAULT_LIMIT) {
  const query = resolveQueryClient();
  const safeLimit = normalizeLimit(limit);

  const result = await query(
    `
    SELECT
      rule_id::text AS rule_id,
      rule_query_id::text AS rule_query_id,
      rule_id::text || '::' || rule_query_id::text AS source_record_id
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, AML_SOURCE_VIEW)}
    ORDER BY rule_id::text, rule_query_id::text
    LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function getLatestHistory(sourceRecordId) {
  const query = resolveQueryClient();

  const result = await query(
    `
    SELECT
      history_id,
      run_id,
      record_type,
      source_record_id,
      action_type,
      old_hash,
      new_hash,
      hash_algorithm,
      sync_status,
      blockchain_key,
      blockchain_transaction_id,
      created_at,
      updated_at
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    WHERE record_type = $1
      AND source_record_id = $2
    ORDER BY created_at DESC, history_id DESC
    LIMIT 1
    `,
    [RECORD_TYPE, sourceRecordId]
  );

  return result.rows[0] || null;
}

async function buildAmlHistoryDecision(sourceKey) {
  const stableHash = await getStableHashFromExistingApi(
    sourceKey.rule_id,
    sourceKey.rule_query_id
  );

  const sourceRecordId = buildSourceRecordId(
    sourceKey.rule_id,
    sourceKey.rule_query_id
  );

  const latestHistory = await getLatestHistory(sourceRecordId);

  let actionType = 'CREATE';
  let oldHash = null;
  let decision = 'INSERT_HISTORY';

  if (latestHistory && latestHistory.new_hash === stableHash) {
    actionType = 'UNCHANGED';
    oldHash = latestHistory.new_hash;
    decision = 'SKIP_UNCHANGED';
  } else if (latestHistory) {
    actionType = 'UPDATE';
    oldHash = latestHistory.new_hash;
    decision = 'INSERT_HISTORY';
  }

  const blockchainKey = buildBlockchainKey(sourceRecordId, stableHash);

  return {
    recordType: RECORD_TYPE,
    ruleId: sourceKey.rule_id,
    ruleQueryId: sourceKey.rule_query_id,
    sourceRecordId,
    actionType,
    decision,
    oldHash,
    stableHash,
    hashAlgorithm: HASH_ALGORITHM,
    blockchainKey,
    latestHistoryId: latestHistory ? latestHistory.history_id : null,
    latestSyncStatus: latestHistory ? latestHistory.sync_status : null
  };
}

async function createSyncRun(runId, submittedBy) {
  const query = resolveQueryClient();
  const columnRows = await getTableColumns(RUNS_TABLE);
  const columns = getColumnNames(columnRows);

  if (!columns.length) {
    return null;
  }

  const now = new Date();

  const runTypeValue = await resolveRunTypeValue();

  const valuesByColumn = {
    run_id: runId,
    run_type: runTypeValue,
    record_type: RECORD_TYPE,
    source_schema_name: BLOCKCHAIN_SCHEMA,
    source_view_name: AML_SOURCE_VIEW,
    source_name: `${BLOCKCHAIN_SCHEMA}.${AML_SOURCE_VIEW}`,
    sync_status: 'IN_PROGRESS',
    run_status: 'IN_PROGRESS',
    status: 'RUNNING',
    started_at: now,
    completed_at: null,
    finished_at: null,
    total_source_records: 0,
    total_records: 0,
    total_create_records: 0,
    total_update_records: 0,
    total_unchanged_records: 0,
    total_failed_records: 0,
    create_count: 0,
    update_count: 0,
    unchanged_count: 0,
    skipped_count: 0,
    inserted_count: 0,
    history_inserted_count: 0,
    error_count: 0,
    submitted_by: submittedBy,
    triggered_by: submittedBy,
    created_by: submittedBy,
    metadata: safeJson({
      integrationStep: 'STEP_18_AML_HISTORY_FIRST',
      recordType: RECORD_TYPE,
      sourceView: `${BLOCKCHAIN_SCHEMA}.${AML_SOURCE_VIEW}`,
      proofOnly: true,
      sensitiveFieldsExcluded: true,
      rawSourceRowExcluded: true
    }),
    created_at: now,
    updated_at: now
  };

  const insertColumns = columns.filter(
    (columnName) => valuesByColumn[columnName] !== undefined
  );

  if (!insertColumns.includes('run_id')) {
    return null;
  }

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

async function updateSyncRun(runId, summary) {
  const query = resolveQueryClient();
  const columnRows = await getTableColumns(RUNS_TABLE);
  const columns = getColumnNames(columnRows);

  if (!columns.includes('run_id')) {
    return null;
  }

  const now = new Date();

  const valuesByColumn = {
    sync_status: 'COMPLETED',
    run_status: 'COMPLETED',
    status: 'COMPLETED',
    completed_at: now,
    finished_at: now,
    total_source_records: summary.totalSourceRecords,
    total_records: summary.scannedRecords,
    total_create_records: summary.createCount,
    total_update_records: summary.updateCount,
    total_unchanged_records: summary.unchangedCount,
    total_failed_records: summary.errorCount,
    create_count: summary.createCount,
    update_count: summary.updateCount,
    unchanged_count: summary.unchangedCount,
    skipped_count: summary.unchangedCount,
    inserted_count: summary.insertedHistoryRows,
    history_inserted_count: summary.insertedHistoryRows,
    error_count: summary.errorCount,
    metadata: safeJson({
      integrationStep: 'STEP_18_AML_HISTORY_FIRST',
      recordType: RECORD_TYPE,
      sourceView: `${BLOCKCHAIN_SCHEMA}.${AML_SOURCE_VIEW}`,
      proofOnly: true,
      sensitiveFieldsExcluded: true,
      rawSourceRowExcluded: true,
      summary
    }),
    updated_at: now
  };

  const updateColumns = columns.filter(
    (columnName) =>
      columnName !== 'run_id' &&
      valuesByColumn[columnName] !== undefined
  );

  if (!updateColumns.length) {
    return null;
  }

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

async function markSyncRunFailed(runId, error) {
  const query = resolveQueryClient();
  const columnRows = await getTableColumns(RUNS_TABLE);
  const columns = getColumnNames(columnRows);

  if (!columns.includes('run_id')) {
    return null;
  }

  const now = new Date();

  const valuesByColumn = {
    sync_status: 'FAILED',
    run_status: 'FAILED',
    status: 'FAILED',
    completed_at: now,
    finished_at: now,
    error_message: error.message,
    last_error: error.message,
    updated_at: now
  };

  const updateColumns = columns.filter(
    (columnName) =>
      columnName !== 'run_id' &&
      valuesByColumn[columnName] !== undefined
  );

  if (!updateColumns.length) {
    return null;
  }

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

async function insertHistoryRow(runId, decision, submittedBy) {
  const query = resolveQueryClient();
  const now = new Date();

  const result = await query(
    `
    INSERT INTO ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    (
      run_id,
      record_type,
      source_schema_name,
      source_view_name,
      source_primary_key,
      source_record_id,
      action_type,
      old_hash,
      new_hash,
      hash_algorithm,
      sync_status,
      blockchain_key,
      blockchain_transaction_id,
      blockchain_submitted_at,
      verification_status,
      verified_at,
      error_message,
      retry_count,
      last_retry_at,
      submitted_by,
      metadata,
      created_at,
      updated_at
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5::jsonb,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      NULL,
      NULL,
      $13,
      NULL,
      NULL,
      0,
      NULL,
      $14,
      $15::jsonb,
      $16,
      $17
    )
    RETURNING history_id
    `,
    [
      runId,
      RECORD_TYPE,
      BLOCKCHAIN_SCHEMA,
      AML_SOURCE_VIEW,
      safeJson({
        rule_id: decision.ruleId,
        rule_query_id: decision.ruleQueryId
      }),
      decision.sourceRecordId,
      decision.actionType,
      decision.oldHash,
      decision.stableHash,
      HASH_ALGORITHM,
      'PENDING_BLOCKCHAIN',
      decision.blockchainKey,
      'NOT_VERIFIED',
      submittedBy,
      safeJson({
        integrationStep: 'STEP_18_AML_HISTORY_FIRST',
        proofOnly: true,
        sourceRecordFormat: 'rule_id::rule_query_id',
        sensitiveFieldsExcluded: true,
        rawSourceRowExcluded: true
      }),
      now,
      now
    ]
  );

  return result.rows[0].history_id;
}

async function previewAmlHistorySync(options = {}) {
  const limit = normalizeLimit(options.limit);
  const sourceKeys = await getAmlSourceKeys(limit);
  const decisions = [];

  for (const sourceKey of sourceKeys) {
    decisions.push(await buildAmlHistoryDecision(sourceKey));
  }

  return {
    dryRun: true,
    recordType: RECORD_TYPE,
    sourceView: `${BLOCKCHAIN_SCHEMA}.${AML_SOURCE_VIEW}`,
    limit,
    scannedRecords: decisions.length,
    createCount: decisions.filter((item) => item.actionType === 'CREATE').length,
    updateCount: decisions.filter((item) => item.actionType === 'UPDATE').length,
    unchangedCount: decisions.filter((item) => item.actionType === 'UNCHANGED').length,
    insertableHistoryRows: decisions.filter(
      (item) => item.decision === 'INSERT_HISTORY'
    ).length,
    decisions
  };
}

async function syncAmlHistory(options = {}) {
  const limit = normalizeLimit(options.limit);
  const dryRun = normalizeDryRun(options.dryRun);
  const submittedBy = options.submittedBy || 'STEP_18_AML_HISTORY_API';

  const sourceCount = await getAmlSourceCount();
  const sourceKeys = await getAmlSourceKeys(limit);
  const decisions = [];

  for (const sourceKey of sourceKeys) {
    decisions.push(await buildAmlHistoryDecision(sourceKey));
  }

  const createCount = decisions.filter((item) => item.actionType === 'CREATE').length;
  const updateCount = decisions.filter((item) => item.actionType === 'UPDATE').length;
  const unchangedCount = decisions.filter((item) => item.actionType === 'UNCHANGED').length;
  const insertable = decisions.filter((item) => item.decision === 'INSERT_HISTORY');

  const summary = {
    dryRun,
    recordType: RECORD_TYPE,
    sourceView: `${BLOCKCHAIN_SCHEMA}.${AML_SOURCE_VIEW}`,
    totalSourceRecords: sourceCount.totalSourceRecords,
    limit,
    scannedRecords: decisions.length,
    createCount,
    updateCount,
    unchangedCount,
    insertableHistoryRows: insertable.length,
    insertedHistoryRows: 0,
    errorCount: 0
  };

  if (dryRun) {
    return {
      ...summary,
      runId: null,
      insertedHistoryIds: [],
      decisions
    };
  }

  const runId = crypto.randomUUID();
  const insertedHistoryIds = [];

  await createSyncRun(runId, submittedBy);

  try {
    for (const decision of insertable) {
      const historyId = await insertHistoryRow(runId, decision, submittedBy);
      insertedHistoryIds.push(historyId);
    }

    summary.insertedHistoryRows = insertedHistoryIds.length;

    await updateSyncRun(runId, summary);

    return {
      ...summary,
      runId,
      insertedHistoryIds,
      decisions
    };
  } catch (error) {
    summary.errorCount = 1;
    await markSyncRunFailed(runId, error);
    throw error;
  }
}

module.exports = {
  getAmlSourceCount,
  previewAmlHistorySync,
  syncAmlHistory
};
