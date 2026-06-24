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


function normalizeValueForHash(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('base64');
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValueForHash(item));
  }

  if (typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalizeValueForHash(value[key]);
        return acc;
      }, {});
  }

  return String(value).trim();
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function generateRowHash(row, excludeColumns = []) {
  const excluded = new Set(excludeColumns);

  const normalizedRow = Object.keys(row)
    .filter((key) => !excluded.has(key))
    .sort()
    .reduce((acc, key) => {
      acc[key] = normalizeValueForHash(row[key]);
      return acc;
    }, {});

  return crypto
    .createHash('sha256')
    .update(stableStringify(normalizedRow))
    .digest('hex');
}

function splitSourceRowAndHistory(row) {
  const historyColumns = new Set([
    'source_record_id',
    'latest_history_id',
    'latest_history_hash',
    'latest_history_action_type',
    'latest_history_sync_status',
    'latest_history_created_at'
  ]);

  const sourceRow = {};

  Object.keys(row).forEach((key) => {
    if (!historyColumns.has(key)) {
      sourceRow[key] = row[key];
    }
  });

  return sourceRow;
}

async function detectUpdateRecords(recordType, limitInput, offsetInput) {
  const config = getSourceViewConfig(recordType);
  const fullViewName = getTrustedFullViewName(config);
  const limit = sanitizeLimit(limitInput, 10, 100);
  const offset = sanitizeOffset(offsetInput);

  const keyColumns = config.sourcePrimaryKey;
  const sourceRecordIdExpression = buildSourceRecordIdSqlExpression(keyColumns);

  const totalSourceRecords = await countSourceRecords(recordType);

  const result = await postgres.query(
    `
    WITH source_records AS (
      SELECT
        src.*,
        ${sourceRecordIdExpression} AS source_record_id
      FROM ${fullViewName} src
    ),
    latest_history AS (
      SELECT DISTINCT ON (record_type, source_record_id)
        history_id,
        record_type,
        source_record_id,
        action_type,
        new_hash,
        sync_status,
        created_at
      FROM blockchain.blockchain_sync_history
      WHERE record_type = $1
      ORDER BY record_type, source_record_id, created_at DESC, history_id DESC
    )
    SELECT
      src.*,
      hist.history_id AS latest_history_id,
      hist.new_hash AS latest_history_hash,
      hist.action_type AS latest_history_action_type,
      hist.sync_status AS latest_history_sync_status,
      hist.created_at AS latest_history_created_at
    FROM source_records src
    INNER JOIN latest_history hist
      ON hist.source_record_id = src.source_record_id
    ORDER BY src.source_record_id
    `,
    [config.recordType]
  );

  const recordsWithHistory = result.rows;

  const updateCandidates = recordsWithHistory
    .map((row) => {
      const sourceRow = splitSourceRowAndHistory(row);
      const currentHash = generateRowHash(sourceRow);
      const latestHistoryHash = row.latest_history_hash;

      return {
        recordType: config.recordType,
        actionType: 'UPDATE',
        sourceViewName: config.fullViewName,
        sourcePrimaryKey: buildSourcePrimaryKey(sourceRow, keyColumns),
        sourceRecordId: row.source_record_id,
        latestHistoryId: row.latest_history_id,
        oldHash: latestHistoryHash,
        newHash: currentHash,
        latestHistorySyncStatus: row.latest_history_sync_status,
        latestHistoryCreatedAt: row.latest_history_created_at,
        changed: latestHistoryHash !== currentHash,
        reason:
          latestHistoryHash !== currentHash
            ? 'Current PostgreSQL source hash differs from latest history hash'
            : 'Current PostgreSQL source hash matches latest history hash'
      };
    })
    .filter((candidate) => candidate.changed === true);

  return {
    recordType: config.recordType,
    sourceViewName: config.fullViewName,
    sourcePrimaryKeyColumns: keyColumns,
    totalSourceRecords,
    existingHistoryRecords: recordsWithHistory.length,
    updateCandidateCount: updateCandidates.length,
    limit,
    offset,
    candidates: updateCandidates.slice(offset, offset + limit)
  };
}


async function detectUnchangedRecords(recordType, limitInput, offsetInput) {
  const config = getSourceViewConfig(recordType);
  const fullViewName = getTrustedFullViewName(config);
  const limit = sanitizeLimit(limitInput, 10, 100);
  const offset = sanitizeOffset(offsetInput);

  const keyColumns = config.sourcePrimaryKey;
  const sourceRecordIdExpression = buildSourceRecordIdSqlExpression(keyColumns);

  const totalSourceRecords = await countSourceRecords(recordType);

  const result = await postgres.query(
    `
    WITH source_records AS (
      SELECT
        src.*,
        ${sourceRecordIdExpression} AS source_record_id
      FROM ${fullViewName} src
    ),
    latest_history AS (
      SELECT DISTINCT ON (record_type, source_record_id)
        history_id,
        record_type,
        source_record_id,
        action_type,
        new_hash,
        sync_status,
        created_at
      FROM blockchain.blockchain_sync_history
      WHERE record_type = $1
      ORDER BY record_type, source_record_id, created_at DESC, history_id DESC
    )
    SELECT
      src.*,
      hist.history_id AS latest_history_id,
      hist.new_hash AS latest_history_hash,
      hist.action_type AS latest_history_action_type,
      hist.sync_status AS latest_history_sync_status,
      hist.created_at AS latest_history_created_at
    FROM source_records src
    INNER JOIN latest_history hist
      ON hist.source_record_id = src.source_record_id
    ORDER BY src.source_record_id
    `,
    [config.recordType]
  );

  const recordsWithHistory = result.rows;

  const unchangedRecords = recordsWithHistory
    .map((row) => {
      const sourceRow = splitSourceRowAndHistory(row);
      const currentHash = generateRowHash(sourceRow);
      const latestHistoryHash = row.latest_history_hash;

      return {
        recordType: config.recordType,
        actionType: 'SKIP_UNCHANGED',
        sourceViewName: config.fullViewName,
        sourcePrimaryKey: buildSourcePrimaryKey(sourceRow, keyColumns),
        sourceRecordId: row.source_record_id,
        latestHistoryId: row.latest_history_id,
        currentHash,
        latestHistoryHash,
        latestHistorySyncStatus: row.latest_history_sync_status,
        latestHistoryCreatedAt: row.latest_history_created_at,
        unchanged: latestHistoryHash === currentHash,
        reason:
          latestHistoryHash === currentHash
            ? 'Current PostgreSQL source hash matches latest history hash; record will be skipped'
            : 'Current PostgreSQL source hash differs from latest history hash'
      };
    })
    .filter((record) => record.unchanged === true);

  return {
    recordType: config.recordType,
    sourceViewName: config.fullViewName,
    sourcePrimaryKeyColumns: keyColumns,
    totalSourceRecords,
    existingHistoryRecords: recordsWithHistory.length,
    unchangedRecordCount: unchangedRecords.length,
    skippedRecordCount: unchangedRecords.length,
    limit,
    offset,
    records: unchangedRecords.slice(offset, offset + limit)
  };
}


function validateSourcePrimaryKeyInput(config, input) {
  const keyColumns = config.sourcePrimaryKey;
  const missingKeys = keyColumns.filter((keyColumn) => {
    const value = input[keyColumn];
    return value === undefined || value === null || String(value).trim() === '';
  });

  if (missingKeys.length > 0) {
    throw new Error(`Missing required source key values: ${missingKeys.join(', ')}`);
  }

  return keyColumns.reduce((acc, keyColumn) => {
    acc[keyColumn] = String(input[keyColumn]).trim();
    return acc;
  }, {});
}

function buildPrimaryKeyWhereClause(keyColumns) {
  return keyColumns
    .map((keyColumn, index) => `${quoteIdentifier(keyColumn)}::TEXT = $${index + 1}`)
    .join(' AND ');
}

async function getSourceRecordForHash(recordType, sourcePrimaryKeyInput) {
  const config = getSourceViewConfig(recordType);
  const fullViewName = getTrustedFullViewName(config);
  const normalizedPrimaryKey = validateSourcePrimaryKeyInput(config, sourcePrimaryKeyInput);

  const keyColumns = config.sourcePrimaryKey;
  const whereClause = buildPrimaryKeyWhereClause(keyColumns);
  const params = keyColumns.map((keyColumn) => normalizedPrimaryKey[keyColumn]);

  const result = await postgres.query(
    `
    SELECT *
    FROM ${fullViewName}
    WHERE ${whereClause}
    LIMIT 1
    `,
    params
  );

  if (result.rows.length === 0) {
    throw new Error(`Source record not found for record type ${config.recordType}`);
  }

  const sourceRow = result.rows[0];

  return {
    config,
    sourceRow,
    sourcePrimaryKey: buildSourcePrimaryKey(sourceRow, keyColumns),
    sourceRecordId: buildSourceRecordId(sourceRow, keyColumns)
  };
}

async function generateStableHashForSourceRecord(recordType, sourcePrimaryKeyInput) {
  const {
    config,
    sourceRow,
    sourcePrimaryKey,
    sourceRecordId
  } = await getSourceRecordForHash(recordType, sourcePrimaryKeyInput);

  const stableHash = generateRowHash(sourceRow);

  return {
    recordType: config.recordType,
    sourceViewName: config.fullViewName,
    sourcePrimaryKeyColumns: config.sourcePrimaryKey,
    sourcePrimaryKey,
    sourceRecordId,
    hashAlgorithm: 'SHA-256',
    stableHash,
    includedColumns: Object.keys(sourceRow).sort(),
    includedColumnCount: Object.keys(sourceRow).length,
    proofOnlyRule: 'Only this hash and non-sensitive metadata will be submitted to blockchain'
  };
}

async function validateStableHashForSourceRecord(recordType, sourcePrimaryKeyInput) {
  const firstHash = await generateStableHashForSourceRecord(recordType, sourcePrimaryKeyInput);
  const secondHash = await generateStableHashForSourceRecord(recordType, sourcePrimaryKeyInput);

  return {
    recordType: firstHash.recordType,
    sourceViewName: firstHash.sourceViewName,
    sourcePrimaryKey: firstHash.sourcePrimaryKey,
    sourceRecordId: firstHash.sourceRecordId,
    hashAlgorithm: firstHash.hashAlgorithm,
    firstHash: firstHash.stableHash,
    secondHash: secondHash.stableHash,
    deterministic: firstHash.stableHash === secondHash.stableHash,
    message:
      firstHash.stableHash === secondHash.stableHash
        ? 'Stable hash validation passed. Same input generated the same hash.'
        : 'Stable hash validation failed. Same input generated different hashes.'
  };
}

async function previewStableHashes(recordType, limitInput, offsetInput) {
  const config = getSourceViewConfig(recordType);
  const fullViewName = getTrustedFullViewName(config);
  const limit = sanitizeLimit(limitInput, 10, 100);
  const offset = sanitizeOffset(offsetInput);
  const keyColumns = config.sourcePrimaryKey;
  const orderColumns = keyColumns.map(quoteIdentifier).join(', ');

  const result = await postgres.query(
    `
    SELECT *
    FROM ${fullViewName}
    ORDER BY ${orderColumns}
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );

  const records = result.rows.map((sourceRow) => ({
    recordType: config.recordType,
    sourceViewName: config.fullViewName,
    sourcePrimaryKey: buildSourcePrimaryKey(sourceRow, keyColumns),
    sourceRecordId: buildSourceRecordId(sourceRow, keyColumns),
    hashAlgorithm: 'SHA-256',
    stableHash: generateRowHash(sourceRow),
    includedColumnCount: Object.keys(sourceRow).length
  }));

  return {
    recordType: config.recordType,
    sourceViewName: config.fullViewName,
    sourcePrimaryKeyColumns: keyColumns,
    totalSourceRecords: await countSourceRecords(recordType),
    limit,
    offset,
    records
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
  detectUpdateRecords,
  detectUnchangedRecords,
  generateStableHashForSourceRecord,
  createSyncRun,
  finishSyncRun,
  createValidationRun,
  checkRequiredTables,
  healthCheck,
  buildSourceRecordId,
  buildSourcePrimaryKey,
  generateRowHash
};
