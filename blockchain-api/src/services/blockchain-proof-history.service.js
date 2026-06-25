'use strict';

/**
 * Step 16 — Blockchain Proof History APIs
 *
 * PostgreSQL remains the source of truth.
 * This service exposes proof-history metadata only.
 *
 * It must not expose:
 * - raw PostgreSQL rows
 * - rule_sql_query
 * - rule_message
 * - PII
 * - secrets
 * - tokens
 * - passwords
 */

const HISTORY_SCHEMA = 'blockchain';

const PREFERRED_HISTORY_TABLES = [
  'blockchain_sync_history',
  'blockchain_proof_history',
  'blockchain_history',
  'sync_history',
  'aml_history'
];

const COLUMN_ALIASES = {
  historyId: [
    'id',
    'history_id',
    'sync_history_id',
    'postgres_history_id',
    'blockchain_sync_history_id'
  ],
  recordType: [
    'record_type',
    'source_record_type',
    'entity_type'
  ],
  sourceRecordId: [
    'source_record_id',
    'source_id',
    'record_id',
    'source_key'
  ],
  stableHash: [
    'stable_hash',
    'new_hash',
    'record_hash',
    'source_hash',
    'data_hash',
    'hash_value',
    'old_hash'
  ],
  hashAlgorithm: [
    'hash_algorithm',
    'algorithm'
  ],
  actionType: [
    'action_type',
    'change_type',
    'operation_type'
  ],
  postgresHistoryId: [
    'postgres_history_id',
    'history_id',
    'id'
  ],
  blockchainKey: [
    'blockchain_key',
    'proof_key'
  ],
  blockchainTransactionId: [
    'blockchain_transaction_id',
    'blockchain_tx_id',
    'fabric_transaction_id',
    'transaction_id',
    'tx_id'
  ],
  syncStatus: [
    'sync_status',
    'status',
    'blockchain_status'
  ],
  submittedBy: [
    'submitted_by',
    'created_by'
  ],
  metadata: [
    'metadata',
    'proof_metadata',
    'safe_metadata'
  ],
  errorMessage: [
    'error_message',
    'last_error',
    'failure_reason'
  ],
  createdAt: [
    'created_at',
    'inserted_at'
  ],
  updatedAt: [
    'updated_at',
    'modified_at'
  ],
  submittedAt: [
    'submitted_at',
    'blockchain_submitted_at',
    'synced_at',
    'created_at',
    'inserted_at'
  ]
};

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
      // Continue checking the next possible existing DB module.
    }
  }

  throw new Error(
    'Unable to resolve PostgreSQL query client. Please confirm the backend database config export.'
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

function normalizeLimit(value, defaultValue = 20, maxValue = 100) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.min(parsed, maxValue);
}

function normalizeOffset(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function normalizeColumns(rawColumns) {
  if (Array.isArray(rawColumns)) {
    return rawColumns;
  }

  if (typeof rawColumns === 'string') {
    const trimmed = rawColumns.trim();

    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed
        .slice(1, -1)
        .split(',')
        .map((columnName) => columnName.replace(/^"|"$/g, '').trim())
        .filter(Boolean);
    }

    return trimmed
      .split(',')
      .map((columnName) => columnName.replace(/^"|"$/g, '').trim())
      .filter(Boolean);
  }

  return [];
}

function resolveColumn(columns, aliases) {
  const lowerColumns = new Set(columns.map((columnName) => columnName.toLowerCase()));

  for (const alias of aliases) {
    if (lowerColumns.has(alias.toLowerCase())) {
      return columns.find(
        (columnName) => columnName.toLowerCase() === alias.toLowerCase()
      );
    }
  }

  return null;
}

function buildColumnMap(columns) {
  const columnMap = {};

  for (const [logicalName, aliases] of Object.entries(COLUMN_ALIASES)) {
    columnMap[logicalName] = resolveColumn(columns, aliases);
  }

  return columnMap;
}

function scoreHistoryTable(tableName, columns) {
  let score = 0;
  const columnSet = new Set(columns.map((columnName) => columnName.toLowerCase()));

  const preferredIndex = PREFERRED_HISTORY_TABLES.indexOf(tableName);
  if (preferredIndex >= 0) {
    score += 100 - preferredIndex;
  }

  if (tableName.includes('history')) {
    score += 20;
  }

  if (columnSet.has('record_type')) {
    score += 20;
  }

  if (columnSet.has('source_record_id')) {
    score += 20;
  }

  if (
    columnSet.has('stable_hash') ||
    columnSet.has('record_hash') ||
    columnSet.has('source_hash') ||
    columnSet.has('hash_value')
  ) {
    score += 20;
  }

  if (
    columnSet.has('blockchain_transaction_id') ||
    columnSet.has('blockchain_tx_id') ||
    columnSet.has('fabric_transaction_id') ||
    columnSet.has('tx_id')
  ) {
    score += 15;
  }

  return score;
}

async function getHistoryTableMetadata() {
  const query = resolveQueryClient();

  const result = await query(
    `
    SELECT
      table_schema,
      table_name,
      array_agg(column_name ORDER BY ordinal_position) AS columns
    FROM information_schema.columns
    WHERE table_schema = $1
      AND (
        table_name = ANY($2::text[])
        OR table_name ILIKE '%history%'
      )
    GROUP BY table_schema, table_name
    ORDER BY table_name
    `,
    [HISTORY_SCHEMA, PREFERRED_HISTORY_TABLES]
  );

  if (!result.rows.length) {
    throw new Error('No blockchain history table found in schema blockchain.');
  }

  const candidates = result.rows
    .map((row) => {
      const normalizedColumns = normalizeColumns(row.columns);

      return {
        schemaName: row.table_schema,
        tableName: row.table_name,
        columns: normalizedColumns,
        score: scoreHistoryTable(row.table_name, normalizedColumns)
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    throw new Error('No compatible blockchain history table found in schema blockchain.');
  }

  const selected = candidates[0];

  return {
    schemaName: selected.schemaName,
    tableName: selected.tableName,
    fullTableName: quoteTable(selected.schemaName, selected.tableName),
    columns: selected.columns,
    columnMap: buildColumnMap(selected.columns)
  };
}

function buildSafeSelectClause(columnMap) {
  const safeFields = [
    'historyId',
    'recordType',
    'sourceRecordId',
    'stableHash',
    'hashAlgorithm',
    'actionType',
    'postgresHistoryId',
    'blockchainKey',
    'blockchainTransactionId',
    'syncStatus',
    'submittedBy',
    'metadata',
    'errorMessage',
    'createdAt',
    'updatedAt',
    'submittedAt'
  ];

  return safeFields
    .map((fieldName) => {
      const columnName = columnMap[fieldName];

      if (!columnName) {
        return `NULL AS "${fieldName}"`;
      }

      return `${quoteIdent(columnName)} AS "${fieldName}"`;
    })
    .join(',\n      ');
}

function getOrderColumn(columnMap) {
  return (
    columnMap.submittedAt ||
    columnMap.createdAt ||
    columnMap.updatedAt ||
    columnMap.historyId
  );
}

async function listHistory(filters = {}) {
  const query = resolveQueryClient();
  const metadata = await getHistoryTableMetadata();

  const {
    recordType,
    sourceRecordId,
    actionType,
    syncStatus,
    limit,
    offset
  } = filters;

  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);

  const params = [];
  const where = [];

  if (recordType && metadata.columnMap.recordType) {
    params.push(String(recordType).toUpperCase());
    where.push(`${quoteIdent(metadata.columnMap.recordType)} = $${params.length}`);
  }

  if (sourceRecordId && metadata.columnMap.sourceRecordId) {
    params.push(String(sourceRecordId));
    where.push(`${quoteIdent(metadata.columnMap.sourceRecordId)} = $${params.length}`);
  }

  if (actionType && metadata.columnMap.actionType) {
    params.push(String(actionType).toUpperCase());
    where.push(`${quoteIdent(metadata.columnMap.actionType)} = $${params.length}`);
  }

  if (syncStatus && metadata.columnMap.syncStatus) {
    params.push(String(syncStatus).toUpperCase());
    where.push(`${quoteIdent(metadata.columnMap.syncStatus)} = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderColumn = getOrderColumn(metadata.columnMap);
  const orderClause = orderColumn ? `ORDER BY ${quoteIdent(orderColumn)} DESC` : '';

  params.push(safeLimit);
  const limitParam = params.length;

  params.push(safeOffset);
  const offsetParam = params.length;

  const result = await query(
    `
    SELECT
      ${buildSafeSelectClause(metadata.columnMap)}
    FROM ${metadata.fullTableName}
    ${whereClause}
    ${orderClause}
    LIMIT $${limitParam}
    OFFSET $${offsetParam}
    `,
    params
  );

  return {
    rows: result.rows,
    meta: {
      table: `${metadata.schemaName}.${metadata.tableName}`,
      limit: safeLimit,
      offset: safeOffset,
      filters: {
        recordType: recordType || null,
        sourceRecordId: sourceRecordId || null,
        actionType: actionType || null,
        syncStatus: syncStatus || null
      }
    }
  };
}

async function getHistoryById(historyId) {
  if (!historyId) {
    throw new Error('historyId is required.');
  }

  const query = resolveQueryClient();
  const metadata = await getHistoryTableMetadata();

  const idColumn = metadata.columnMap.historyId;

  if (!idColumn) {
    throw new Error('The selected history table does not expose a history ID column.');
  }

  const result = await query(
    `
    SELECT
      ${buildSafeSelectClause(metadata.columnMap)}
    FROM ${metadata.fullTableName}
    WHERE ${quoteIdent(idColumn)}::text = $1
    LIMIT 1
    `,
    [String(historyId)]
  );

  return {
    row: result.rows[0] || null,
    meta: {
      table: `${metadata.schemaName}.${metadata.tableName}`,
      historyId: String(historyId)
    }
  };
}

async function getLatestHistoryForSource(recordType, sourceRecordId) {
  if (!recordType) {
    throw new Error('recordType is required.');
  }

  if (!sourceRecordId) {
    throw new Error('sourceRecordId is required.');
  }

  const result = await listHistory({
    recordType,
    sourceRecordId,
    limit: 1,
    offset: 0
  });

  return {
    row: result.rows[0] || null,
    meta: result.meta
  };
}

async function getHistorySummary() {
  const query = resolveQueryClient();
  const metadata = await getHistoryTableMetadata();

  const recordTypeExpression = metadata.columnMap.recordType
    ? quoteIdent(metadata.columnMap.recordType)
    : 'NULL';

  const syncStatusExpression = metadata.columnMap.syncStatus
    ? quoteIdent(metadata.columnMap.syncStatus)
    : 'NULL';

  const actionTypeExpression = metadata.columnMap.actionType
    ? quoteIdent(metadata.columnMap.actionType)
    : 'NULL';

  const result = await query(
    `
    SELECT
      ${recordTypeExpression} AS "recordType",
      ${syncStatusExpression} AS "syncStatus",
      ${actionTypeExpression} AS "actionType",
      COUNT(*)::int AS "count"
    FROM ${metadata.fullTableName}
    GROUP BY 1, 2, 3
    ORDER BY 1, 2, 3
    `
  );

  return {
    rows: result.rows,
    meta: {
      table: `${metadata.schemaName}.${metadata.tableName}`
    }
  };
}

async function getHealth() {
  const query = resolveQueryClient();
  const metadata = await getHistoryTableMetadata();

  const result = await query(
    `
    SELECT COUNT(*)::int AS total
    FROM ${metadata.fullTableName}
    `
  );

  return {
    status: 'UP',
    table: `${metadata.schemaName}.${metadata.tableName}`,
    totalRows: result.rows[0] ? result.rows[0].total : 0,
    safeColumnsExposed: Object.keys(COLUMN_ALIASES),
    sourceOfTruth: 'PostgreSQL',
    blockchainStoragePolicy: 'PROOF_ONLY'
  };
}

module.exports = {
  getHealth,
  listHistory,
  getHistoryById,
  getLatestHistoryForSource,
  getHistorySummary
};
