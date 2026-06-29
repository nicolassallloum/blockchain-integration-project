'use strict';

/**
 * Step 19 — Implement Customer Data History
 *
 * PostgreSQL remains the source of truth.
 * Blockchain stores proof only.
 *
 * This service creates PostgreSQL history rows for CUSTOMER proof records.
 *
 * It must not store or return:
 * - raw PostgreSQL customer rows
 * - customer name
 * - phone
 * - email
 * - address
 * - date of birth
 * - national ID
 * - passport number
 * - PII
 * - tokens
 * - passwords
 * - secrets
 */

const crypto = require('crypto');
const { submitBlockchainProof } = require('./blockchain-proof-fabric-submit.service');

const BLOCKCHAIN_SCHEMA = 'blockchain';
const HISTORY_TABLE = 'blockchain_sync_history';
const RUNS_TABLE = 'blockchain_sync_runs';

const RECORD_TYPE = 'CUSTOMER';
const HASH_ALGORITHM = 'SHA-256';
const BLOCKCHAIN_KEY_VERSION = 'V1';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

const CUSTOMER_SOURCE_VIEW_CANDIDATES = [
  process.env.BLOCKCHAIN_PROOF_CUSTOMER_SOURCE_VIEW,
  'customer_data_sync',
  'customers_sync',
  'customer_sync',
  'valoores_customer_data_sync',
  'valoores_customers_sync',
  'customer_master_sync',
  'customer_profile_sync',
  'resident_customer_sync',
  'residents_sync',
  'resident_sync',
  'customers',
  'customer_data'
].filter(Boolean);

const CUSTOMER_SOURCE_ID_CANDIDATE_GROUPS = [
  ['customer_id'],
  ['customer_code'],
  ['customer_no'],
  ['customer_number'],
  ['cif_id'],
  ['cif'],
  ['client_id'],
  ['client_code'],
  ['resident_id'],
  ['party_id'],
  ['person_id'],
  ['entity_id'],
  ['id']
];

const SENSITIVE_COLUMN_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /credential/i,
  /phone/i,
  /mobile/i,
  /email/i,
  /address/i,
  /name/i,
  /full_name/i,
  /first_name/i,
  /last_name/i,
  /father/i,
  /mother/i,
  /dob/i,
  /birth/i,
  /national/i,
  /passport/i,
  /document/i,
  /ssn/i,
  /tax/i,
  /iban/i,
  /account_number/i,
  /card/i
];

const VOLATILE_COLUMN_PATTERNS = [
  /^created_at$/i,
  /^updated_at$/i,
  /^inserted_at$/i,
  /^modified_at$/i,
  /^last_login/i,
  /^last_seen/i,
  /^sync_/i,
  /^etl_/i,
  /^load_/i
];

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

function safeJson(value) {
  return JSON.stringify(value || {});
}

function isSensitiveColumn(columnName) {
  return SENSITIVE_COLUMN_PATTERNS.some((pattern) => pattern.test(columnName));
}

function isVolatileColumn(columnName) {
  return VOLATILE_COLUMN_PATTERNS.some((pattern) => pattern.test(columnName));
}

function normalizeValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('hex');
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === 'object') {
    return canonicalizeObject(value);
  }

  return value;
}

function canonicalizeObject(obj) {
  const output = {};

  for (const key of Object.keys(obj).sort()) {
    output[key] = normalizeValue(obj[key]);
  }

  return output;
}

function buildHashInput(row, columns) {
  const hashPayload = {};

  for (const column of columns) {
    if (isVolatileColumn(column)) {
      continue;
    }

    hashPayload[column] = normalizeValue(row[column]);
  }

  return JSON.stringify(canonicalizeObject(hashPayload));
}

function generateStableHash(row, columns) {
  return crypto
    .createHash('sha256')
    .update(buildHashInput(row, columns), 'utf8')
    .digest('hex');
}

function buildSourceRecordId(row, primaryKeyColumns) {
  return primaryKeyColumns
    .map((columnName) => String(row[columnName]))
    .join('::');
}

function buildBlockchainKey(sourceRecordId, stableHash) {
  return `BCPROOF::${BLOCKCHAIN_KEY_VERSION}::${RECORD_TYPE}::${sourceRecordId}::${stableHash.substring(0, 16)}`;
}

function buildSafePrimaryKey(row, primaryKeyColumns) {
  const key = {};

  for (const columnName of primaryKeyColumns) {
    key[columnName] = row[columnName] === null || row[columnName] === undefined
      ? null
      : String(row[columnName]);
  }

  return key;
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
    'MANUAL',
    'SCHEDULED',
    'RETRY',
    'VERIFY'
  ];

  for (const preferredValue of preferredValues) {
    if (allowedValues.includes(preferredValue)) {
      return preferredValue;
    }
  }

  return allowedValues[0];
}

async function resolveHistorySyncStatusValue() {
  const allowedValues = await getAllowedCheckValues(HISTORY_TABLE, 'sync_status');

  if (!allowedValues.length) {
    return 'PENDING';
  }

  const preferredValues = [
    'PENDING',
    'NEW',
    'READY',
    'QUEUED',
    'CREATED',
    'NOT_SUBMITTED',
    'PENDING_SUBMISSION',
    'PENDING_BLOCKCHAIN',
    'PENDING_BLOCKCHAIN_SUBMISSION'
  ];

  for (const preferredValue of preferredValues) {
    if (allowedValues.includes(preferredValue)) {
      return preferredValue;
    }
  }

  return allowedValues[0];
}

async function resolveHistoryVerificationStatusValue() {
  const allowedValues = await getAllowedCheckValues(HISTORY_TABLE, 'verification_status');

  if (!allowedValues.length) {
    return 'NOT_VERIFIED';
  }

  const preferredValues = [
    'NOT_VERIFIED',
    'PENDING',
    'UNVERIFIED',
    'NOT_CHECKED',
    'PENDING_VERIFICATION'
  ];

  for (const preferredValue of preferredValues) {
    if (allowedValues.includes(preferredValue)) {
      return preferredValue;
    }
  }

  return allowedValues[0];
}

function resolvePrimaryKeyColumns(columns) {
  const lowerToOriginal = new Map(
    columns.map((columnName) => [columnName.toLowerCase(), columnName])
  );

  for (const group of CUSTOMER_SOURCE_ID_CANDIDATE_GROUPS) {
    const matchedGroup = group
      .map((columnName) => lowerToOriginal.get(columnName.toLowerCase()))
      .filter(Boolean);

    if (matchedGroup.length === group.length) {
      return matchedGroup;
    }
  }

  return [];
}

async function discoverCustomerSourceViews() {
  const query = resolveQueryClient();

  const result = await query(
    `
    SELECT
      table_schema,
      table_name,
      table_type
    FROM information_schema.tables
    WHERE table_schema = $1
      AND (
            table_name = ANY($2::text[])
            OR table_name ILIKE '%customer%'
            OR table_name ILIKE '%client%'
            OR table_name ILIKE '%resident%'
            OR table_name ILIKE '%party%'
          )
    ORDER BY
      CASE WHEN table_name = ANY($2::text[]) THEN 0 ELSE 1 END,
      table_name
    `,
    [BLOCKCHAIN_SCHEMA, CUSTOMER_SOURCE_VIEW_CANDIDATES]
  );

  const discovered = [];

  for (const row of result.rows) {
    const columnRows = await getTableColumns(row.table_name);
    const columns = getColumnNames(columnRows);
    const primaryKeyColumns = resolvePrimaryKeyColumns(columns);

    discovered.push({
      schemaName: row.table_schema,
      viewName: row.table_name,
      tableType: row.table_type,
      primaryKeyColumns,
      hasPrimaryKeyCandidate: primaryKeyColumns.length > 0,
      safeColumnCount: columns.filter((columnName) => !isSensitiveColumn(columnName)).length,
      totalColumnCount: columns.length
    });
  }

  return {
    recordType: RECORD_TYPE,
    configuredCandidateViews: CUSTOMER_SOURCE_VIEW_CANDIDATES,
    discoveredViews: discovered,
    selectedView: discovered.find((item) => item.hasPrimaryKeyCandidate) || null,
    piiPolicy: {
      rawRowsReturned: false,
      sensitiveFieldsReturned: false,
      sensitiveFieldsStored: false,
      hashOnlyStored: true
    }
  };
}

async function getSelectedCustomerSourceView() {
  const discovery = await discoverCustomerSourceViews();

  if (!discovery.selectedView) {
    throw new Error(
      'No usable customer source view found in schema blockchain. Create or configure BLOCKCHAIN_PROOF_CUSTOMER_SOURCE_VIEW with a customer_id/client_id/resident_id/id column.'
    );
  }

  return discovery.selectedView;
}

async function getCustomerSourceCount() {
  const query = resolveQueryClient();
  const selectedView = await getSelectedCustomerSourceView();

  const result = await query(
    `
    SELECT COUNT(*)::int AS total
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, selectedView.viewName)}
    `
  );

  return {
    recordType: RECORD_TYPE,
    sourceView: `${BLOCKCHAIN_SCHEMA}.${selectedView.viewName}`,
    primaryKeyColumns: selectedView.primaryKeyColumns,
    totalSourceRecords: result.rows[0] ? result.rows[0].total : 0
  };
}

async function getCustomerSourceRows(limit = DEFAULT_LIMIT) {
  const query = resolveQueryClient();
  const selectedView = await getSelectedCustomerSourceView();
  const columnRows = await getTableColumns(selectedView.viewName);
  const columns = getColumnNames(columnRows);
  const primaryKeyColumns = selectedView.primaryKeyColumns;
  const safeLimit = normalizeLimit(limit);

  const orderClause = primaryKeyColumns
    .map((columnName) => `${quoteIdent(columnName)}::text`)
    .join(', ');

  const result = await query(
    `
    SELECT *
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, selectedView.viewName)}
    ORDER BY ${orderClause}
    LIMIT $1
    `,
    [safeLimit]
  );

  return {
    sourceView: selectedView,
    columns,
    primaryKeyColumns,
    rows: result.rows
  };
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

async function buildCustomerHistoryDecision(rowContext, row) {
  const stableHash = generateStableHash(row, rowContext.columns);
  const sourceRecordId = buildSourceRecordId(row, rowContext.primaryKeyColumns);
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
    sourceRecordId,
    actionType,
    decision,
    oldHash,
    stableHash,
    hashAlgorithm: HASH_ALGORITHM,
    blockchainKey,
    sourcePrimaryKey: buildSafePrimaryKey(row, rowContext.primaryKeyColumns),
    latestHistoryId: latestHistory ? latestHistory.history_id : null,
    latestSyncStatus: latestHistory ? latestHistory.sync_status : null
  };
}

async function createSyncRun(runId, submittedBy, sourceViewName) {
  const query = resolveQueryClient();
  const columnRows = await getTableColumns(RUNS_TABLE);
  const columns = getColumnNames(columnRows);
  const now = new Date();
  const runTypeValue = await resolveRunTypeValue();

  const valuesByColumn = {
    run_id: runId,
    run_type: runTypeValue,
    record_type: RECORD_TYPE,
    source_view_name: sourceViewName,
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
      integrationStep: 'STEP_19_CUSTOMER_DATA_HISTORY',
      recordType: RECORD_TYPE,
      sourceView: `${BLOCKCHAIN_SCHEMA}.${sourceViewName}`,
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
  const now = new Date();

  const valuesByColumn = {
    finished_at: now,
    status: 'COMPLETED',
    total_source_records: summary.totalSourceRecords,
    total_create_records: summary.createCount,
    total_update_records: summary.updateCount,
    total_unchanged_records: summary.unchangedCount,
    total_failed_records: summary.errorCount,
    metadata: safeJson({
      integrationStep: 'STEP_19_CUSTOMER_DATA_HISTORY',
      recordType: RECORD_TYPE,
      sourceView: summary.sourceView,
      proofOnly: true,
      sensitiveFieldsExcluded: true,
      rawSourceRowExcluded: true,
      summary: {
        scannedRecords: summary.scannedRecords,
        createCount: summary.createCount,
        updateCount: summary.updateCount,
        unchangedCount: summary.unchangedCount,
        insertedHistoryRows: summary.insertedHistoryRows,
        errorCount: summary.errorCount
      }
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

async function markSyncRunFailed(runId, error) {
  const query = resolveQueryClient();
  const columnRows = await getTableColumns(RUNS_TABLE);
  const columns = getColumnNames(columnRows);
  const now = new Date();

  const valuesByColumn = {
    finished_at: now,
    status: 'FAILED',
    total_failed_records: 1,
    error_message: error.message,
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

async function insertHistoryRow(runId, sourceViewName, decision, submittedBy) {
  const query = resolveQueryClient();
  const now = new Date();
  const historySyncStatus = await resolveHistorySyncStatusValue();
  const historyVerificationStatus = await resolveHistoryVerificationStatusValue();

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
      sourceViewName,
      safeJson(decision.sourcePrimaryKey),
      decision.sourceRecordId,
      decision.actionType,
      decision.oldHash,
      decision.stableHash,
      HASH_ALGORITHM,
      historySyncStatus,
      decision.blockchainKey,
      historyVerificationStatus,
      submittedBy,
      safeJson({
        integrationStep: 'STEP_19_CUSTOMER_DATA_HISTORY',
        proofOnly: true,
        sourceRecordFormat: decision.sourcePrimaryKey,
        sensitiveFieldsExcluded: true,
        rawSourceRowExcluded: true
      }),
      now,
      now
    ]
  );

  return result.rows[0].history_id;
}


function truncateError(value) {
  if (!value) {
    return null;
  }

  return String(value).slice(0, 2000);
}

async function resolveFabricSubmittedSyncStatusValue() {
  const allowedValues = await getAllowedCheckValues(HISTORY_TABLE, 'sync_status');

  if (!allowedValues.length) {
    return 'SUBMITTED';
  }

  const preferredValues = [
    'SUBMITTED',
    'SYNCED',
    'SUCCESS',
    'COMPLETED',
    'DONE',
    'ON_CHAIN',
    'BLOCKCHAIN_SUBMITTED',
    'PENDING'
  ];

  for (const preferredValue of preferredValues) {
    if (allowedValues.includes(preferredValue)) {
      return preferredValue;
    }
  }

  return await resolveHistorySyncStatusValue();
}

async function resolveFabricFailedSyncStatusValue() {
  const allowedValues = await getAllowedCheckValues(HISTORY_TABLE, 'sync_status');

  if (!allowedValues.length) {
    return 'FAILED';
  }

  const preferredValues = [
    'FAILED',
    'ERROR',
    'SUBMISSION_FAILED',
    'BLOCKCHAIN_FAILED',
    'PENDING_RETRY',
    'RETRY',
    'PENDING'
  ];

  for (const preferredValue of preferredValues) {
    if (allowedValues.includes(preferredValue)) {
      return preferredValue;
    }
  }

  return await resolveHistorySyncStatusValue();
}

function extractFabricTransactionId(fabricResult) {
  return fabricResult?.fabric?.transactionId ||
    fabricResult?.transactionId ||
    fabricResult?.txId ||
    null;
}

async function updateHistoryAfterFabricSuccess(historyId, fabricResult) {
  const query = resolveQueryClient();
  const now = new Date();
  const submittedStatus = await resolveFabricSubmittedSyncStatusValue();
  const fabricTransactionId = extractFabricTransactionId(fabricResult);

  await query(
    `
    UPDATE ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    SET
      sync_status = $1,
      blockchain_transaction_id = $2,
      blockchain_submitted_at = $3,
      error_message = NULL,
      metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
      updated_at = $5
    WHERE history_id = $6
    `,
    [
      submittedStatus,
      fabricTransactionId,
      now,
      safeJson({
        fabricSubmitted: true,
        fabricSubmissionService: fabricResult?.fabric?.service || null,
        fabricSubmissionMethod: fabricResult?.fabric?.method || null,
        fabricTransactionId,
        proofOnly: true
      }),
      now,
      historyId
    ]
  );

  return fabricTransactionId;
}

async function markHistoryFabricFailed(historyId, error) {
  const query = resolveQueryClient();
  const now = new Date();
  const failedStatus = await resolveFabricFailedSyncStatusValue();

  await query(
    `
    UPDATE ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    SET
      sync_status = $1,
      error_message = $2,
      last_retry_at = $3,
      metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
      updated_at = $5
    WHERE history_id = $6
    `,
    [
      failedStatus,
      truncateError(error.message),
      now,
      safeJson({
        fabricSubmitted: false,
        fabricSubmissionError: truncateError(error.message),
        proofOnly: true
      }),
      now,
      historyId
    ]
  );
}

async function previewCustomerHistorySync(options = {}) {
  const limit = normalizeLimit(options.limit);
  const rowContext = await getCustomerSourceRows(limit);
  const decisions = [];

  for (const row of rowContext.rows) {
    decisions.push(await buildCustomerHistoryDecision(rowContext, row));
  }

  return {
    dryRun: true,
    recordType: RECORD_TYPE,
    sourceView: `${BLOCKCHAIN_SCHEMA}.${rowContext.sourceView.viewName}`,
    primaryKeyColumns: rowContext.primaryKeyColumns,
    limit,
    scannedRecords: decisions.length,
    createCount: decisions.filter((item) => item.actionType === 'CREATE').length,
    updateCount: decisions.filter((item) => item.actionType === 'UPDATE').length,
    unchangedCount: decisions.filter((item) => item.actionType === 'UNCHANGED').length,
    insertableHistoryRows: decisions.filter(
      (item) => item.decision === 'INSERT_HISTORY'
    ).length,
    decisions: decisions.map((item) => ({
      recordType: item.recordType,
      sourceRecordId: item.sourceRecordId,
      actionType: item.actionType,
      decision: item.decision,
      oldHash: item.oldHash,
      stableHash: item.stableHash,
      hashAlgorithm: item.hashAlgorithm,
      blockchainKey: item.blockchainKey,
      latestHistoryId: item.latestHistoryId,
      latestSyncStatus: item.latestSyncStatus
    })),
    piiPolicy: {
      rawRowsReturned: false,
      sensitiveFieldsReturned: false,
      sensitiveFieldsStored: false,
      hashOnlyStored: true
    }
  };
}

async function syncCustomerHistory(options = {}) {
  const limit = normalizeLimit(options.limit);
  const dryRun = normalizeDryRun(options.dryRun);
  const submittedBy = options.submittedBy || 'STEP_19_CUSTOMER_HISTORY_API';

  const sourceCount = await getCustomerSourceCount();
  const rowContext = await getCustomerSourceRows(limit);
  const decisions = [];

  for (const row of rowContext.rows) {
    decisions.push(await buildCustomerHistoryDecision(rowContext, row));
  }

  const createCount = decisions.filter((item) => item.actionType === 'CREATE').length;
  const updateCount = decisions.filter((item) => item.actionType === 'UPDATE').length;
  const unchangedCount = decisions.filter((item) => item.actionType === 'UNCHANGED').length;
  const insertable = decisions.filter((item) => item.decision === 'INSERT_HISTORY');

  const summary = {
    dryRun,
    recordType: RECORD_TYPE,
    sourceView: `${BLOCKCHAIN_SCHEMA}.${rowContext.sourceView.viewName}`,
    primaryKeyColumns: rowContext.primaryKeyColumns,
    totalSourceRecords: sourceCount.totalSourceRecords,
    limit,
    scannedRecords: decisions.length,
    createCount,
    updateCount,
    unchangedCount,
    insertableHistoryRows: insertable.length,
    insertedHistoryRows: 0,
    fabricSubmittedCount: 0,
    fabricFailedCount: 0,
    errorCount: 0
  };

  if (dryRun) {
    return {
      ...summary,
      runId: null,
      insertedHistoryIds: [],
      decisions: decisions.map((item) => ({
        recordType: item.recordType,
        sourceRecordId: item.sourceRecordId,
        actionType: item.actionType,
        decision: item.decision,
        oldHash: item.oldHash,
        stableHash: item.stableHash,
        hashAlgorithm: item.hashAlgorithm,
        blockchainKey: item.blockchainKey,
        latestHistoryId: item.latestHistoryId,
        latestSyncStatus: item.latestSyncStatus
      }))
    };
  }

  const runId = crypto.randomUUID();
  const insertedHistoryIds = [];

  await createSyncRun(runId, submittedBy, rowContext.sourceView.viewName);

  try {
    const fabricSubmissionResults = [];

    for (const decision of insertable) {
      const historyId = await insertHistoryRow(
        runId,
        rowContext.sourceView.viewName,
        decision,
        submittedBy
      );

      insertedHistoryIds.push(historyId);

      try {
        const fabricResult = await submitBlockchainProof(
          {
            blockchainKey: decision.blockchainKey,
            recordType: decision.recordType,
            sourceRecordId: decision.sourceRecordId,
            stableHash: decision.stableHash,
            actionType: decision.actionType,
            postgresHistoryId: historyId,
            submittedBy,
            metadata: {
              integrationStep: 'STEP_19_CUSTOMER_DATA_HISTORY',
              sourceView: `${BLOCKCHAIN_SCHEMA}.${rowContext.sourceView.viewName}`,
              proofOnly: true,
              sensitiveFieldsExcluded: true,
              rawSourceRowExcluded: true
            }
          },
          {
            dryRun: false
          }
        );

        const fabricTransactionId = await updateHistoryAfterFabricSuccess(
          historyId,
          fabricResult
        );

        summary.fabricSubmittedCount += 1;

        fabricSubmissionResults.push({
          historyId,
          sourceRecordId: decision.sourceRecordId,
          blockchainKey: decision.blockchainKey,
          submitted: true,
          fabricTransactionId
        });
      } catch (fabricError) {
        summary.fabricFailedCount += 1;

        await markHistoryFabricFailed(historyId, fabricError);

        fabricSubmissionResults.push({
          historyId,
          sourceRecordId: decision.sourceRecordId,
          blockchainKey: decision.blockchainKey,
          submitted: false,
          errorMessage: truncateError(fabricError.message)
        });
      }
    }

    summary.insertedHistoryRows = insertedHistoryIds.length;
    summary.errorCount = summary.fabricFailedCount;

    await updateSyncRun(runId, summary);

    return {
      ...summary,
      runId,
      insertedHistoryIds,
      fabricSubmissionResults,
      decisions: decisions.map((item) => ({
        recordType: item.recordType,
        sourceRecordId: item.sourceRecordId,
        actionType: item.actionType,
        decision: item.decision,
        oldHash: item.oldHash,
        stableHash: item.stableHash,
        hashAlgorithm: item.hashAlgorithm,
        blockchainKey: item.blockchainKey,
        latestHistoryId: item.latestHistoryId,
        latestSyncStatus: item.latestSyncStatus
      }))
    };
  } catch (error) {
    summary.errorCount = 1;
    await markSyncRunFailed(runId, error);
    throw error;
  }
}

module.exports = {
  discoverCustomerSourceViews,
  getCustomerSourceCount,
  previewCustomerHistorySync,
  syncCustomerHistory
};
