'use strict';

/**
 * Step 17 — Blockchain Proof Verification APIs
 *
 * PostgreSQL remains the source of truth.
 * Blockchain stores proof only.
 *
 * This service exposes verification metadata only.
 *
 * It must not expose:
 * - raw PostgreSQL rows
 * - AML rule_sql_query
 * - AML rule_message
 * - customer PII
 * - tokens
 * - passwords
 * - secrets
 */

const BLOCKCHAIN_SCHEMA = 'blockchain';
const VERIFICATION_TABLE = 'blockchain_verification_logs';
const HISTORY_TABLE = 'blockchain_sync_history';
const AML_SOURCE_VIEW = 'valoores_aml_rules_sync';

const VERIFICATION_COLUMN_ALIASES = {
  verificationId: [
    'verification_id',
    'id',
    'log_id',
    'verification_log_id'
  ],
  historyId: [
    'history_id',
    'postgres_history_id',
    'sync_history_id',
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
  blockchainKey: [
    'blockchain_key',
    'proof_key'
  ],
  postgresHash: [
    'postgres_hash',
    'source_hash',
    'stable_hash',
    'new_hash',
    'record_hash'
  ],
  blockchainHash: [
    'blockchain_hash',
    'ledger_hash',
    'fabric_hash'
  ],
  hashMatch: [
    'hash_match',
    'is_hash_match',
    'matched'
  ],
  verificationStatus: [
    'verification_status',
    'status'
  ],
  verificationMethod: [
    'verification_method',
    'method'
  ],
  blockchainTransactionId: [
    'blockchain_transaction_id',
    'blockchain_tx_id',
    'fabric_transaction_id',
    'transaction_id',
    'tx_id'
  ],
  verifiedBy: [
    'verified_by',
    'submitted_by',
    'created_by'
  ],
  verifiedAt: [
    'verified_at',
    'created_at'
  ],
  metadata: [
    'metadata',
    'verification_metadata',
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
  ]
};

const HISTORY_COLUMN_ALIASES = {
  historyId: [
    'history_id',
    'id',
    'postgres_history_id'
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
  syncStatus: [
    'sync_status',
    'status',
    'blockchain_status'
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

function buildColumnMap(columns, aliases) {
  const columnMap = {};

  for (const [logicalName, aliasList] of Object.entries(aliases)) {
    columnMap[logicalName] = resolveColumn(columns, aliasList);
  }

  return columnMap;
}

async function getTableMetadata(tableName, aliases) {
  const query = resolveQueryClient();

  const result = await query(
    `
    SELECT
      table_schema,
      table_name,
      array_agg(column_name ORDER BY ordinal_position) AS columns
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
    GROUP BY table_schema, table_name
    LIMIT 1
    `,
    [BLOCKCHAIN_SCHEMA, tableName]
  );

  if (!result.rows.length) {
    throw new Error(`Required table not found: ${BLOCKCHAIN_SCHEMA}.${tableName}`);
  }

  const columns = normalizeColumns(result.rows[0].columns);

  return {
    schemaName: result.rows[0].table_schema,
    tableName: result.rows[0].table_name,
    fullTableName: quoteTable(result.rows[0].table_schema, result.rows[0].table_name),
    columns,
    columnMap: buildColumnMap(columns, aliases)
  };
}

function buildSafeSelectClause(columnMap, fields) {
  return fields
    .map((fieldName) => {
      const columnName = columnMap[fieldName];

      if (!columnName) {
        return `NULL AS "${fieldName}"`;
      }

      return `${quoteIdent(columnName)} AS "${fieldName}"`;
    })
    .join(',\n      ');
}

function getVerificationOrderColumn(columnMap) {
  return (
    columnMap.verifiedAt ||
    columnMap.createdAt ||
    columnMap.updatedAt ||
    columnMap.verificationId
  );
}

function getHistoryOrderColumn(columnMap) {
  return (
    columnMap.submittedAt ||
    columnMap.createdAt ||
    columnMap.updatedAt ||
    columnMap.historyId
  );
}

function buildSourceRecordId(recordType, query) {
  const normalizedRecordType = String(recordType || '').toUpperCase();

  if (query.sourceRecordId) {
    return String(query.sourceRecordId);
  }

  if (
    normalizedRecordType === 'AML' &&
    query.rule_id &&
    query.rule_query_id
  ) {
    return `${String(query.rule_id)}::${String(query.rule_query_id)}`;
  }

  return null;
}

async function getHealth() {
  const query = resolveQueryClient();
  const verificationMetadata = await getTableMetadata(
    VERIFICATION_TABLE,
    VERIFICATION_COLUMN_ALIASES
  );

  const historyMetadata = await getTableMetadata(
    HISTORY_TABLE,
    HISTORY_COLUMN_ALIASES
  );

  const verificationCount = await query(
    `
    SELECT COUNT(*)::int AS total
    FROM ${verificationMetadata.fullTableName}
    `
  );

  const historyCount = await query(
    `
    SELECT COUNT(*)::int AS total
    FROM ${historyMetadata.fullTableName}
    `
  );

  return {
    status: 'UP',
    verificationTable: `${verificationMetadata.schemaName}.${verificationMetadata.tableName}`,
    historyTable: `${historyMetadata.schemaName}.${historyMetadata.tableName}`,
    totalVerificationRows: verificationCount.rows[0]
      ? verificationCount.rows[0].total
      : 0,
    totalHistoryRows: historyCount.rows[0]
      ? historyCount.rows[0].total
      : 0,
    safeColumnsExposed: Object.keys(VERIFICATION_COLUMN_ALIASES),
    sourceOfTruth: 'PostgreSQL',
    blockchainStoragePolicy: 'PROOF_ONLY',
    liveFabricVerification: false
  };
}

async function listVerificationLogs(filters = {}) {
  const query = resolveQueryClient();
  const metadata = await getTableMetadata(
    VERIFICATION_TABLE,
    VERIFICATION_COLUMN_ALIASES
  );

  const {
    recordType,
    sourceRecordId,
    verificationStatus,
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

  if (verificationStatus && metadata.columnMap.verificationStatus) {
    params.push(String(verificationStatus).toUpperCase());
    where.push(`${quoteIdent(metadata.columnMap.verificationStatus)} = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderColumn = getVerificationOrderColumn(metadata.columnMap);
  const orderClause = orderColumn ? `ORDER BY ${quoteIdent(orderColumn)} DESC` : '';

  params.push(safeLimit);
  const limitParam = params.length;

  params.push(safeOffset);
  const offsetParam = params.length;

  const safeFields = [
    'verificationId',
    'historyId',
    'recordType',
    'sourceRecordId',
    'blockchainKey',
    'postgresHash',
    'blockchainHash',
    'hashMatch',
    'verificationStatus',
    'verificationMethod',
    'blockchainTransactionId',
    'verifiedBy',
    'verifiedAt',
    'metadata',
    'errorMessage',
    'createdAt',
    'updatedAt'
  ];

  const result = await query(
    `
    SELECT
      ${buildSafeSelectClause(metadata.columnMap, safeFields)}
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
        verificationStatus: verificationStatus || null
      }
    }
  };
}

async function getVerificationLogById(verificationId) {
  if (!verificationId) {
    throw new Error('verificationId is required.');
  }

  const metadata = await getTableMetadata(
    VERIFICATION_TABLE,
    VERIFICATION_COLUMN_ALIASES
  );

  const idColumn = metadata.columnMap.verificationId;

  if (!idColumn) {
    throw new Error('The verification table does not expose a verification ID column.');
  }

  const query = resolveQueryClient();

  const safeFields = [
    'verificationId',
    'historyId',
    'recordType',
    'sourceRecordId',
    'blockchainKey',
    'postgresHash',
    'blockchainHash',
    'hashMatch',
    'verificationStatus',
    'verificationMethod',
    'blockchainTransactionId',
    'verifiedBy',
    'verifiedAt',
    'metadata',
    'errorMessage',
    'createdAt',
    'updatedAt'
  ];

  const result = await query(
    `
    SELECT
      ${buildSafeSelectClause(metadata.columnMap, safeFields)}
    FROM ${metadata.fullTableName}
    WHERE ${quoteIdent(idColumn)}::text = $1
    LIMIT 1
    `,
    [String(verificationId)]
  );

  return {
    row: result.rows[0] || null,
    meta: {
      table: `${metadata.schemaName}.${metadata.tableName}`,
      verificationId: String(verificationId)
    }
  };
}

async function getLatestVerificationLog(recordType, sourceRecordId) {
  if (!recordType) {
    throw new Error('recordType is required.');
  }

  if (!sourceRecordId) {
    throw new Error('sourceRecordId is required.');
  }

  const result = await listVerificationLogs({
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

async function getVerificationSummary() {
  const metadata = await getTableMetadata(
    VERIFICATION_TABLE,
    VERIFICATION_COLUMN_ALIASES
  );

  const recordTypeExpression = metadata.columnMap.recordType
    ? quoteIdent(metadata.columnMap.recordType)
    : 'NULL';

  const statusExpression = metadata.columnMap.verificationStatus
    ? quoteIdent(metadata.columnMap.verificationStatus)
    : 'NULL';

  const methodExpression = metadata.columnMap.verificationMethod
    ? quoteIdent(metadata.columnMap.verificationMethod)
    : 'NULL';

  const query = resolveQueryClient();

  const result = await query(
    `
    SELECT
      ${recordTypeExpression} AS "recordType",
      ${statusExpression} AS "verificationStatus",
      ${methodExpression} AS "verificationMethod",
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

async function getLatestHistoryForRecord(recordType, sourceRecordId) {
  const metadata = await getTableMetadata(
    HISTORY_TABLE,
    HISTORY_COLUMN_ALIASES
  );

  const query = resolveQueryClient();

  const params = [];
  const where = [];

  if (metadata.columnMap.recordType) {
    params.push(String(recordType).toUpperCase());
    where.push(`${quoteIdent(metadata.columnMap.recordType)} = $${params.length}`);
  }

  if (metadata.columnMap.sourceRecordId) {
    params.push(String(sourceRecordId));
    where.push(`${quoteIdent(metadata.columnMap.sourceRecordId)} = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderColumn = getHistoryOrderColumn(metadata.columnMap);
  const orderClause = orderColumn ? `ORDER BY ${quoteIdent(orderColumn)} DESC` : '';

  const safeFields = [
    'historyId',
    'recordType',
    'sourceRecordId',
    'stableHash',
    'hashAlgorithm',
    'actionType',
    'syncStatus',
    'blockchainKey',
    'blockchainTransactionId',
    'createdAt',
    'updatedAt',
    'submittedAt'
  ];

  const result = await query(
    `
    SELECT
      ${buildSafeSelectClause(metadata.columnMap, safeFields)}
    FROM ${metadata.fullTableName}
    ${whereClause}
    ${orderClause}
    LIMIT 1
    `,
    params
  );

  return {
    row: result.rows[0] || null,
    meta: {
      table: `${metadata.schemaName}.${metadata.tableName}`
    }
  };
}

async function checkAmlSourceRecordExists(sourceRecordId) {
  const parts = String(sourceRecordId || '').split('::');

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return {
      exists: false,
      reason: 'AML sourceRecordId must use rule_id::rule_query_id format.'
    };
  }

  const query = resolveQueryClient();

  const result = await query(
    `
    SELECT COUNT(*)::int AS total
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, AML_SOURCE_VIEW)}
    WHERE rule_id::text = $1
      AND rule_query_id::text = $2
    `,
    [parts[0], parts[1]]
  );

  return {
    exists: Boolean(result.rows[0] && result.rows[0].total > 0),
    reason: null
  };
}

async function previewVerification(recordType, requestQuery = {}) {
  const normalizedRecordType = String(recordType || '').toUpperCase();

  if (!normalizedRecordType) {
    throw new Error('recordType is required.');
  }

  const sourceRecordId = buildSourceRecordId(normalizedRecordType, requestQuery);

  if (!sourceRecordId) {
    throw new Error(
      'sourceRecordId is required. For AML, you may also provide rule_id and rule_query_id.'
    );
  }

  let sourceCheck = {
    exists: null,
    reason: 'Source existence check is not implemented for this record type yet.'
  };

  if (normalizedRecordType === 'AML') {
    sourceCheck = await checkAmlSourceRecordExists(sourceRecordId);
  }

  const latestHistory = await getLatestHistoryForRecord(
    normalizedRecordType,
    sourceRecordId
  );

  const latestVerification = await getLatestVerificationLog(
    normalizedRecordType,
    sourceRecordId
  );

  return {
    verificationMode: 'PREVIEW_ONLY',
    liveFabricVerification: false,
    recordType: normalizedRecordType,
    sourceRecordId,
    sourceRecordExists: sourceCheck.exists,
    sourceRecordCheckReason: sourceCheck.reason,
    latestPostgresHistory: latestHistory.row,
    latestVerificationLog: latestVerification.row,
    readyForStep23VerificationLogic: Boolean(sourceCheck.exists),
    securityPolicy: {
      postgresSourceOfTruth: true,
      blockchainStoresProofOnly: true,
      sensitiveFieldsExcluded: true,
      rawSourceRowExcluded: true
    }
  };
}

module.exports = {
  getHealth,
  listVerificationLogs,
  getVerificationLogById,
  getLatestVerificationLog,
  getVerificationSummary,
  previewVerification
};
