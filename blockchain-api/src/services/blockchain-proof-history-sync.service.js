const crypto = require('crypto');

const sourceViewsConfig = require('../config/blockchain-proof-source-views.config');
const postgres = require('./blockchain-proof-postgres.service');

const SERVICE_NAME = 'postgres-blockchain-proof-sync-service';

function normalizeRecordType(recordType) {
  return String(recordType || '').trim().toUpperCase();
}

function sanitizeLimit(value, defaultValue = 10, maxValue = 100) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.min(parsed, maxValue);
}

function sanitizeOffset(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function quoteIdentifier(identifier) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

function getSourceViewConfig(recordType) {
  const normalizedRecordType = normalizeRecordType(recordType);
  const config = sourceViewsConfig.sourceViews[normalizedRecordType];

  if (!config) {
    throw new Error(`Unsupported record type: ${recordType}`);
  }

  if (!config.enabled || !config.confirmed) {
    throw new Error(`Source view is not enabled or not confirmed for record type: ${recordType}`);
  }

  if (!config.sourceSchema || !config.sourceView) {
    throw new Error(`Source schema/view is missing for record type: ${recordType}`);
  }

  if (!Array.isArray(config.sourcePrimaryKey) || config.sourcePrimaryKey.length === 0) {
    throw new Error(`Source primary key is missing for record type: ${recordType}`);
  }

  return config;
}

function getTrustedFullViewName(config) {
  const schema = quoteIdentifier(config.sourceSchema);
  const view = quoteIdentifier(config.sourceView);

  return `${schema}.${view}`;
}

function buildSourcePrimaryKey(row, keyColumns) {
  return keyColumns.reduce((acc, keyColumn) => {
    acc[keyColumn] = row[keyColumn] === null || row[keyColumn] === undefined
      ? null
      : String(row[keyColumn]);

    return acc;
  }, {});
}

function buildSourceRecordId(row, keyColumns) {
  return keyColumns
    .map((keyColumn) => {
      const value = row[keyColumn];

      if (value === null || value === undefined || String(value).trim() === '') {
        throw new Error(`Missing source primary key value for column: ${keyColumn}`);
      }

      return String(value).trim();
    })
    .join('::');
}

async function countSourceRecords(recordType) {
  const config = getSourceViewConfig(recordType);
  const fullViewName = getTrustedFullViewName(config);

  const result = await postgres.query(
    `SELECT COUNT(*)::BIGINT AS total_records FROM ${fullViewName}`
  );

  return Number(result.rows[0].total_records);
}

async function previewSourceRecords(recordType, limitInput, offsetInput) {
  const config = getSourceViewConfig(recordType);
  const fullViewName = getTrustedFullViewName(config);
  const limit = sanitizeLimit(limitInput, 10, 100);
  const offset = sanitizeOffset(offsetInput);

  const keyColumns = config.sourcePrimaryKey;
  const selectColumns = keyColumns.map(quoteIdentifier).join(', ');
  const orderColumns = keyColumns.map(quoteIdentifier).join(', ');

  const result = await postgres.query(
    `
    SELECT ${selectColumns}
    FROM ${fullViewName}
    ORDER BY ${orderColumns}
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );

  const records = result.rows.map((row) => ({
    recordType: config.recordType,
    sourceViewName: config.fullViewName,
    sourcePrimaryKey: buildSourcePrimaryKey(row, keyColumns),
    sourceRecordId: buildSourceRecordId(row, keyColumns)
  }));

  return {
    recordType: config.recordType,
    sourceViewName: config.fullViewName,
    sourcePrimaryKeyColumns: keyColumns,
    limit,
    offset,
    records
  };
}


function buildSourceRecordIdSqlExpression(keyColumns) {
  return `CONCAT_WS('::', ${keyColumns.map((keyColumn) => `${quoteIdentifier(keyColumn)}::TEXT`).join(', ')})`;
}

async function detectCreateRecords(recordType, limitInput, offsetInput) {
  const config = getSourceViewConfig(recordType);
  const fullViewName = getTrustedFullViewName(config);
  const limit = sanitizeLimit(limitInput, 10, 100);
  const offset = sanitizeOffset(offsetInput);

  const keyColumns = config.sourcePrimaryKey;
  const selectColumns = keyColumns.map(quoteIdentifier).join(', ');
  const orderColumns = keyColumns.map(quoteIdentifier).join(', ');
  const sourceRecordIdExpression = buildSourceRecordIdSqlExpression(keyColumns);

  const totalSourceRecords = await countSourceRecords(recordType);

  const countResult = await postgres.query(
    `
    WITH source_records AS (
      SELECT
        ${sourceRecordIdExpression} AS source_record_id
      FROM ${fullViewName}
    ),
    existing_history AS (
      SELECT DISTINCT
        source_record_id
      FROM blockchain.blockchain_sync_history
      WHERE record_type = $1
    )
    SELECT
      COUNT(*)::BIGINT AS create_candidate_count
    FROM source_records src
    LEFT JOIN existing_history hist
      ON hist.source_record_id = src.source_record_id
    WHERE hist.source_record_id IS NULL
    `,
    [config.recordType]
  );

  const candidatesResult = await postgres.query(
    `
    WITH source_records AS (
      SELECT
        ${selectColumns},
        ${sourceRecordIdExpression} AS source_record_id
      FROM ${fullViewName}
    ),
    existing_history AS (
      SELECT DISTINCT
        source_record_id
      FROM blockchain.blockchain_sync_history
      WHERE record_type = $1
    )
    SELECT
      ${selectColumns},
      src.source_record_id
    FROM source_records src
    LEFT JOIN existing_history hist
      ON hist.source_record_id = src.source_record_id
    WHERE hist.source_record_id IS NULL
    ORDER BY ${orderColumns}
    LIMIT $2 OFFSET $3
    `,
    [config.recordType, limit, offset]
  );

  const createCandidateCount = Number(countResult.rows[0].create_candidate_count);

  const candidates = candidatesResult.rows.map((row) => ({
    recordType: config.recordType,
    actionType: 'CREATE',
    sourceViewName: config.fullViewName,
    sourcePrimaryKey: buildSourcePrimaryKey(row, keyColumns),
    sourceRecordId: row.source_record_id,
    reason: 'No existing history record found for this source record'
  }));

  return {
    recordType: config.recordType,
    sourceViewName: config.fullViewName,
    sourcePrimaryKeyColumns: keyColumns,
    totalSourceRecords,
    existingHistoryRecords: totalSourceRecords - createCandidateCount,
    createCandidateCount,
    limit,
    offset,
    candidates
  };
}

async function createSyncRun({
  runType = 'MANUAL',
  recordType,
  sourceViewName,
  triggeredBy = SERVICE_NAME,
  metadata = {}
}) {
  const runId = crypto.randomUUID();

  const result = await postgres.query(
    `
    INSERT INTO blockchain.blockchain_sync_runs (
      run_id,
      run_type,
      record_type,
      source_view_name,
      status,
      triggered_by,
      metadata
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      'RUNNING',
      $5,
      $6::jsonb
    )
    RETURNING *
    `,
    [
      runId,
      runType,
      normalizeRecordType(recordType),
      sourceViewName,
      triggeredBy,
      JSON.stringify(metadata)
    ]
  );

  return result.rows[0];
}

async function finishSyncRun({
  runId,
  status = 'COMPLETED',
  totalSourceRecords = 0,
  totalCreateRecords = 0,
  totalUpdateRecords = 0,
  totalUnchangedRecords = 0,
  totalFailedRecords = 0,
  errorMessage = null
}) {
  const result = await postgres.query(
    `
    UPDATE blockchain.blockchain_sync_runs
    SET
      status = $2,
      finished_at = NOW(),
      total_source_records = $3,
      total_create_records = $4,
      total_update_records = $5,
      total_unchanged_records = $6,
      total_failed_records = $7,
      error_message = $8
    WHERE run_id = $1
    RETURNING *
    `,
    [
      runId,
      status,
      totalSourceRecords,
      totalCreateRecords,
      totalUpdateRecords,
      totalUnchangedRecords,
      totalFailedRecords,
      errorMessage
    ]
  );

  return result.rows[0];
}

async function createValidationRun(recordType) {
  const config = getSourceViewConfig(recordType);
  const totalSourceRecords = await countSourceRecords(recordType);

  const run = await createSyncRun({
    runType: 'MANUAL',
    recordType: config.recordType,
    sourceViewName: config.fullViewName,
    triggeredBy: 'step06-validation',
    metadata: {
      test: true,
      step: 'STEP_6',
      purpose: 'Validate generic history sync service'
    }
  });

  const finishedRun = await finishSyncRun({
    runId: run.run_id,
    status: 'COMPLETED',
    totalSourceRecords,
    totalCreateRecords: 0,
    totalUpdateRecords: 0,
    totalUnchangedRecords: totalSourceRecords,
    totalFailedRecords: 0
  });

  return finishedRun;
}

async function checkRequiredTables() {
  const requiredTables = [
    'blockchain_sync_runs',
    'blockchain_sync_history',
    'blockchain_verification_logs'
  ];

  const result = await postgres.query(
    `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'blockchain'
      AND table_name = ANY($1)
    ORDER BY table_name
    `,
    [requiredTables]
  );

  const foundTables = result.rows.map((row) => row.table_name);
  const missingTables = requiredTables.filter((tableName) => !foundTables.includes(tableName));

  return {
    requiredTables,
    foundTables,
    missingTables,
    valid: missingTables.length === 0
  };
}

async function healthCheck() {
  const database = await postgres.healthCheck();
  const tables = await checkRequiredTables();

  return {
    serviceName: SERVICE_NAME,
    database,
    tables,
    ready: tables.valid
  };
}

module.exports = {
  SERVICE_NAME,
  getSourceViewConfig,
  countSourceRecords,
  previewSourceRecords,
  detectCreateRecords,
  createSyncRun,
  finishSyncRun,
  createValidationRun,
  checkRequiredTables,
  healthCheck,
  buildSourceRecordId,
  buildSourcePrimaryKey
};
