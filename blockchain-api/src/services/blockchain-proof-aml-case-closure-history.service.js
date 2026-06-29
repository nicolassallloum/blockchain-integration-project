'use strict';

const crypto = require('crypto');
const db = require('../config/database');
const { submitBlockchainProof } = require('./blockchain-proof-fabric-submit.service');

const query = db.query ? db.query.bind(db) : db.pool.query.bind(db.pool);

const BLOCKCHAIN_SCHEMA = 'blockchain';
const SOURCE_VIEW = 'aml_case_closure_sync';
const HISTORY_TABLE = 'blockchain_sync_history';

const RECORD_TYPE = 'AML_CASE_CLOSURE';
const HASH_ALGORITHM = 'SHA-256';
const BLOCKCHAIN_KEY_VERSION = 'V1';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const HASH_FIELDS = [
  'case_id',
  'case_number',
  'alert_id',
  'case_status',
  'priority',
  'risk_level',
  'risk_score',
  'assigned_team',
  'opened_at',
  'reviewed_at',
  'closed_at',
  'updated_at',
  'closure_reason_provided',
  'source_record_id'
];

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function normalizeDryRun(value) {
  if (value === true) {
    return true;
  }

  if (value === false || value === undefined || value === null) {
    return false;
  }

  return ['true', '1', 'yes', 'y'].includes(String(value).trim().toLowerCase());
}

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function quoteTable(schemaName, tableName) {
  return `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;
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

function normalizeForHash(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return String(value).trim();
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();

    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function buildHashPayload(row) {
  const payload = {};

  for (const field of HASH_FIELDS) {
    payload[field] = normalizeForHash(row[field]);
  }

  return payload;
}

function generateStableHash(row) {
  const payload = buildHashPayload(row);

  return crypto
    .createHash('sha256')
    .update(stableStringify(payload))
    .digest('hex');
}

function buildBlockchainKey(sourceRecordId, stableHash) {
  return `BCPROOF::${BLOCKCHAIN_KEY_VERSION}::${RECORD_TYPE}::${sourceRecordId}::${stableHash.substring(0, 16)}`;
}

function extractFabricTransactionId(fabricResult) {
  return fabricResult?.fabric?.transactionId ||
    fabricResult?.transactionId ||
    fabricResult?.txId ||
    null;
}

async function discoverAmlCaseClosureSourceViews() {
  const existsResult = await query(
    `
    SELECT
      table_schema,
      table_name,
      table_type
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_name = $2
    `,
    [BLOCKCHAIN_SCHEMA, SOURCE_VIEW]
  );

  const columnsResult = await query(
    `
    SELECT
      column_name,
      data_type,
      ordinal_position
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
    ORDER BY ordinal_position
    `,
    [BLOCKCHAIN_SCHEMA, SOURCE_VIEW]
  );

  return {
    recordType: RECORD_TYPE,
    selectedSourceView: existsResult.rows.length
      ? `${BLOCKCHAIN_SCHEMA}.${SOURCE_VIEW}`
      : null,
    exists: existsResult.rows.length > 0,
    primaryKeyColumns: ['case_id'],
    sourceRecordIdColumn: 'source_record_id',
    hashAlgorithm: HASH_ALGORITHM,
    hashFields: HASH_FIELDS,
    columns: columnsResult.rows,
    proofPolicy: {
      proofOnly: true,
      rawRowsReturned: false,
      closureReasonExcluded: true,
      investigationNotesExcluded: true,
      caseDescriptionExcluded: true,
      sensitiveFieldsExcluded: true
    }
  };
}

async function getAmlCaseClosureSourceCount() {
  const result = await query(
    `
    SELECT COUNT(*)::int AS total_source_records
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, SOURCE_VIEW)}
    `
  );

  return {
    recordType: RECORD_TYPE,
    sourceView: `${BLOCKCHAIN_SCHEMA}.${SOURCE_VIEW}`,
    totalSourceRecords: result.rows[0]?.total_source_records || 0
  };
}

async function getAmlCaseClosureSourceRows(limit = DEFAULT_LIMIT) {
  const normalizedLimit = normalizeLimit(limit);

  const result = await query(
    `
    SELECT *
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, SOURCE_VIEW)}
    ORDER BY closed_at DESC NULLS LAST, case_id
    LIMIT $1
    `,
    [normalizedLimit]
  );

  return {
    sourceView: {
      schemaName: BLOCKCHAIN_SCHEMA,
      viewName: SOURCE_VIEW
    },
    primaryKeyColumns: ['case_id'],
    rows: result.rows
  };
}

async function getLatestHistory(sourceRecordId) {
  const result = await query(
    `
    SELECT
      history_id,
      new_hash,
      sync_status,
      blockchain_key,
      blockchain_transaction_id,
      created_at
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    WHERE record_type = $1
      AND source_record_id = $2
    ORDER BY history_id DESC
    LIMIT 1
    `,
    [RECORD_TYPE, sourceRecordId]
  );

  return result.rows[0] || null;
}

async function buildAmlCaseClosureHistoryDecision(row) {
  const sourceRecordId = row.source_record_id || `AML_CASE_CLOSURE::${row.case_id}`;
  const sourcePrimaryKey = {
    case_id: row.case_id
  };

  const stableHash = generateStableHash(row);
  const blockchainKey = buildBlockchainKey(sourceRecordId, stableHash);
  const latestHistory = await getLatestHistory(sourceRecordId);

  if (!latestHistory) {
    return {
      recordType: RECORD_TYPE,
      sourceRecordId,
      sourcePrimaryKey,
      actionType: 'CREATE',
      decision: 'INSERT_HISTORY',
      oldHash: null,
      stableHash,
      hashAlgorithm: HASH_ALGORITHM,
      blockchainKey,
      latestHistoryId: null,
      latestSyncStatus: null
    };
  }

  if (latestHistory.new_hash !== stableHash) {
    return {
      recordType: RECORD_TYPE,
      sourceRecordId,
      sourcePrimaryKey,
      actionType: 'UPDATE',
      decision: 'INSERT_HISTORY',
      oldHash: latestHistory.new_hash,
      stableHash,
      hashAlgorithm: HASH_ALGORITHM,
      blockchainKey,
      latestHistoryId: latestHistory.history_id,
      latestSyncStatus: latestHistory.sync_status
    };
  }

  return {
    recordType: RECORD_TYPE,
    sourceRecordId,
    sourcePrimaryKey,
    actionType: 'UNCHANGED',
    decision: 'SKIP_UNCHANGED',
    oldHash: latestHistory.new_hash,
    stableHash,
    hashAlgorithm: HASH_ALGORITHM,
    blockchainKey: latestHistory.blockchain_key || blockchainKey,
    latestHistoryId: latestHistory.history_id,
    latestSyncStatus: latestHistory.sync_status
  };
}

async function insertHistoryRow(decision, submittedBy) {
  const now = new Date();

  const result = await query(
    `
    INSERT INTO ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    (
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
      $4::jsonb,
      $5,
      $6,
      $7,
      $8,
      $9,
      'PENDING',
      $10,
      NULL,
      NULL,
      'NOT_VERIFIED',
      NULL,
      NULL,
      0,
      NULL,
      $11,
      $12::jsonb,
      $13,
      $14
    )
    RETURNING history_id
    `,
    [
      RECORD_TYPE,
      BLOCKCHAIN_SCHEMA,
      SOURCE_VIEW,
      safeJson(decision.sourcePrimaryKey),
      decision.sourceRecordId,
      decision.actionType,
      decision.oldHash,
      decision.stableHash,
      HASH_ALGORITHM,
      decision.blockchainKey,
      submittedBy,
      safeJson({
        integrationStep: 'STEP_11_AML_CASE_CLOSURE_HISTORY',
        proofOnly: true,
        sourceRecordFormat: decision.sourcePrimaryKey,
        closureReasonExcluded: true,
        investigationNotesExcluded: true,
        caseDescriptionExcluded: true,
        rawSourceRowExcluded: true,
        sensitiveFieldsExcluded: true
      }),
      now,
      now
    ]
  );

  return result.rows[0].history_id;
}

async function updateHistoryAfterFabricSuccess(historyId, fabricResult) {
  const now = new Date();
  const fabricTransactionId = extractFabricTransactionId(fabricResult);

  await query(
    `
    UPDATE ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    SET
      sync_status = 'SYNCED',
      blockchain_transaction_id = $1,
      blockchain_submitted_at = $2,
      error_message = NULL,
      metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
      updated_at = $4
    WHERE history_id = $5
    `,
    [
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
  const now = new Date();

  await query(
    `
    UPDATE ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    SET
      sync_status = 'FAILED',
      error_message = $1,
      last_retry_at = $2,
      metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
      updated_at = $4
    WHERE history_id = $5
    `,
    [
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

function mapDecisionForResponse(item) {
  return {
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
  };
}

async function previewAmlCaseClosureHistorySync(options = {}) {
  const limit = normalizeLimit(options.limit);
  const rowContext = await getAmlCaseClosureSourceRows(limit);
  const decisions = [];

  for (const row of rowContext.rows) {
    decisions.push(await buildAmlCaseClosureHistoryDecision(row));
  }

  return {
    dryRun: true,
    recordType: RECORD_TYPE,
    sourceView: `${BLOCKCHAIN_SCHEMA}.${SOURCE_VIEW}`,
    primaryKeyColumns: rowContext.primaryKeyColumns,
    limit,
    scannedRecords: decisions.length,
    createCount: decisions.filter((item) => item.actionType === 'CREATE').length,
    updateCount: decisions.filter((item) => item.actionType === 'UPDATE').length,
    unchangedCount: decisions.filter((item) => item.actionType === 'UNCHANGED').length,
    insertableHistoryRows: decisions.filter((item) => item.decision === 'INSERT_HISTORY').length,
    decisions: decisions.map(mapDecisionForResponse),
    proofPolicy: {
      proofOnly: true,
      rawRowsReturned: false,
      closureReasonExcluded: true,
      investigationNotesExcluded: true,
      caseDescriptionExcluded: true,
      sensitiveFieldsExcluded: true,
      hashOnlyStored: true
    }
  };
}

async function syncAmlCaseClosureHistory(options = {}) {
  const limit = normalizeLimit(options.limit);
  const dryRun = normalizeDryRun(options.dryRun);
  const submittedBy = options.submittedBy || 'STEP_11_AML_CASE_CLOSURE_HISTORY_API';

  const sourceCount = await getAmlCaseClosureSourceCount();
  const rowContext = await getAmlCaseClosureSourceRows(limit);
  const decisions = [];

  for (const row of rowContext.rows) {
    decisions.push(await buildAmlCaseClosureHistoryDecision(row));
  }

  const insertable = decisions.filter((item) => item.decision === 'INSERT_HISTORY');

  const summary = {
    dryRun,
    recordType: RECORD_TYPE,
    sourceView: `${BLOCKCHAIN_SCHEMA}.${SOURCE_VIEW}`,
    primaryKeyColumns: rowContext.primaryKeyColumns,
    totalSourceRecords: sourceCount.totalSourceRecords,
    limit,
    scannedRecords: decisions.length,
    createCount: decisions.filter((item) => item.actionType === 'CREATE').length,
    updateCount: decisions.filter((item) => item.actionType === 'UPDATE').length,
    unchangedCount: decisions.filter((item) => item.actionType === 'UNCHANGED').length,
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
      decisions: decisions.map(mapDecisionForResponse)
    };
  }

  const insertedHistoryIds = [];
  const fabricSubmissionResults = [];

  for (const decision of insertable) {
    const historyId = await insertHistoryRow(decision, submittedBy);
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
            integrationStep: 'STEP_11_AML_CASE_CLOSURE_HISTORY',
            sourceView: `${BLOCKCHAIN_SCHEMA}.${SOURCE_VIEW}`,
            proofOnly: true,
            closureReasonExcluded: true,
            investigationNotesExcluded: true,
            caseDescriptionExcluded: true,
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

  return {
    ...summary,
    runId: null,
    insertedHistoryIds,
    fabricSubmissionResults,
    decisions: decisions.map(mapDecisionForResponse)
  };
}

module.exports = {
  discoverAmlCaseClosureSourceViews,
  getAmlCaseClosureSourceCount,
  previewAmlCaseClosureHistorySync,
  syncAmlCaseClosureHistory
};
