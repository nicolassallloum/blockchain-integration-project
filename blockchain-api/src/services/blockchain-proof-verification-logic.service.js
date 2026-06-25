'use strict';

/**
 * Step 23 — Verification Logic
 *
 * PostgreSQL remains the source of truth.
 * Blockchain stores proof only.
 *
 * This service:
 * - Recomputes PostgreSQL source hash.
 * - Compares source hash with stored history hash.
 * - Optionally verifies blockchain hash only when a real blockchain tx exists.
 * - Writes verification logs.
 * - Never fakes blockchain success.
 * - Never returns raw source rows.
 */

const crypto = require('crypto');
const http = require('http');
const https = require('https');

const BLOCKCHAIN_SCHEMA = 'blockchain';
const HISTORY_TABLE = 'blockchain_sync_history';
const VERIFICATION_TABLE = 'blockchain_verification_logs';

const HASH_ALGORITHM = 'SHA-256';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 500;

const INTERNAL_API_BASE_URL =
  process.env.BLOCKCHAIN_PROOF_API_INTERNAL_BASE_URL ||
  'http://127.0.0.1:3001/api/v1/blockchain-proof/api';

const BLOCKCHAIN_VERIFY_ENDPOINT =
  process.env.BLOCKCHAIN_PROOF_VERIFY_URL ||
  process.env.BLOCKCHAIN_VERIFY_URL ||
  null;

const VOLATILE_COLUMN_PATTERNS = [
  /^created_at$/i,
  /^updated_at$/i,
  /^inserted_at$/i,
  /^modified_at$/i,
  /^last_updated/i,
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

async function resolveVerificationStatusValue(outcome) {
  const allowedValues = await getAllowedCheckValues(VERIFICATION_TABLE, 'verification_status');

  if (!allowedValues.length) {
    return outcome === 'VERIFIED'
      ? 'VERIFIED'
      : outcome === 'FAILED'
        ? 'FAILED'
        : 'NOT_VERIFIED';
  }

  const preferredByOutcome = {
    VERIFIED: ['VERIFIED', 'SUCCESS', 'PASSED', 'MATCHED'],
    FAILED: ['FAILED', 'ERROR', 'MISMATCH', 'NOT_VERIFIED', 'PENDING'],
    NOT_VERIFIED: ['NOT_VERIFIED', 'PENDING', 'UNVERIFIED', 'NOT_CHECKED', 'FAILED']
  };

  const preferredValues = preferredByOutcome[outcome] || preferredByOutcome.NOT_VERIFIED;

  for (const preferredValue of preferredValues) {
    if (allowedValues.includes(preferredValue)) {
      return preferredValue;
    }
  }

  if (outcome === 'NOT_VERIFIED') {
    throw new Error(
      'Verification status constraint does not contain a safe non-verified value. Refusing to write fake VERIFIED status.'
    );
  }

  return allowedValues[0];
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
    'new_hash',
    'postgresHash',
    'postgres_hash',
    'blockchainHash',
    'blockchain_hash'
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
          try {
            const json = responseBody ? JSON.parse(responseBody) : {};

            if (response.statusCode < 200 || response.statusCode >= 300) {
              return reject(
                new Error(
                  `Blockchain verify endpoint failed with HTTP ${response.statusCode}: ${json.message || responseBody}`
                )
              );
            }

            return resolve(json);
          } catch (error) {
            return reject(
              new Error(`Blockchain verify endpoint returned invalid JSON: ${error.message}`)
            );
          }
        });
      }
    );

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy(new Error('Blockchain verify endpoint request timed out.'));
    });

    request.write(body);
    request.end();
  });
}

function parseSourcePrimaryKey(value) {
  if (!value) {
    return {};
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    // Ignore JSON parse error.
  }

  return {};
}

function buildSafeCandidate(row) {
  return {
    historyId: String(row.history_id),
    recordType: row.record_type,
    sourceRecordId: row.source_record_id,
    sourceView: `${row.source_schema_name || BLOCKCHAIN_SCHEMA}.${row.source_view_name}`,
    stableHash: row.new_hash,
    hashAlgorithm: row.hash_algorithm || HASH_ALGORITHM,
    blockchainKey: row.blockchain_key,
    blockchainTransactionId: row.blockchain_transaction_id,
    syncStatus: row.sync_status,
    verificationStatus: row.verification_status,
    retryCount: Number(row.retry_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getVerificationHealth() {
  const query = resolveQueryClient();

  const historyResult = await query(
    `
    SELECT
      record_type,
      sync_status,
      verification_status,
      COUNT(*)::int AS total_rows,
      COUNT(*) FILTER (WHERE blockchain_transaction_id IS NOT NULL)::int AS rows_with_blockchain_tx,
      COUNT(*) FILTER (WHERE blockchain_transaction_id IS NULL)::int AS rows_without_blockchain_tx
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    GROUP BY record_type, sync_status, verification_status
    ORDER BY record_type, sync_status, verification_status
    `
  );

  const logResult = await query(
    `
    SELECT COUNT(*)::int AS total_logs
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, VERIFICATION_TABLE)}
    `
  );

  const totalHistoryRows = historyResult.rows.reduce(
    (sum, row) => sum + Number(row.total_rows || 0),
    0
  );

  const totalRowsWithBlockchainTx = historyResult.rows.reduce(
    (sum, row) => sum + Number(row.rows_with_blockchain_tx || 0),
    0
  );

  return {
    status: 'UP',
    historyTable: `${BLOCKCHAIN_SCHEMA}.${HISTORY_TABLE}`,
    verificationTable: `${BLOCKCHAIN_SCHEMA}.${VERIFICATION_TABLE}`,
    totalHistoryRows,
    totalRowsWithBlockchainTx,
    totalRowsWithoutBlockchainTx: totalHistoryRows - totalRowsWithBlockchainTx,
    totalVerificationLogs: logResult.rows[0] ? logResult.rows[0].total_logs : 0,
    blockchainVerifyEndpointConfigured: Boolean(BLOCKCHAIN_VERIFY_ENDPOINT),
    verificationPolicy: {
      postgresSourceHashCompared: true,
      blockchainVerificationRequiresTransactionId: true,
      blockchainVerificationRequiresVerifyEndpoint: true,
      fakeBlockchainSuccess: false,
      rawRowsReturned: false,
      sensitiveFieldsReturned: false
    },
    rowsByRecordType: historyResult.rows
  };
}

async function getVerificationCandidates(options = {}) {
  const query = resolveQueryClient();
  const recordType = normalizeRecordType(options.recordType);
  const sourceRecordId = options.sourceRecordId || null;
  const limit = normalizeLimit(options.limit);

  const result = await query(
    `
    SELECT
      history_id,
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
      verification_status,
      retry_count,
      created_at,
      updated_at
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    WHERE new_hash IS NOT NULL
      AND ($1::text IS NULL OR record_type = $1)
      AND ($2::text IS NULL OR source_record_id = $2)
    ORDER BY created_at ASC, history_id ASC
    LIMIT $3
    `,
    [recordType, sourceRecordId, limit]
  );

  return {
    recordType: recordType || 'ALL',
    sourceRecordId,
    limit,
    totalCandidates: result.rows.length,
    blockchainVerifyEndpointConfigured: Boolean(BLOCKCHAIN_VERIFY_ENDPOINT),
    candidates: result.rows.map(buildSafeCandidate)
  };
}

async function getAmlStableHashFromExistingApi(sourceRecordId) {
  const [ruleId, ruleQueryId] = String(sourceRecordId).split('::');

  if (!ruleId || !ruleQueryId) {
    throw new Error(`Invalid AML sourceRecordId format: ${sourceRecordId}`);
  }

  const url =
    `${INTERNAL_API_BASE_URL}/records/AML/hash` +
    `?rule_id=${encodeURIComponent(ruleId)}` +
    `&rule_query_id=${encodeURIComponent(ruleQueryId)}`;

  const response = await httpGetJson(url);
  const stableHash = findStableHash(response);

  if (!stableHash) {
    throw new Error('Unable to find AML stable hash in internal hash API response.');
  }

  return stableHash;
}

async function recomputeSourceHashFromPostgres(historyRow) {
  const query = resolveQueryClient();

  if (historyRow.record_type === 'AML') {
    try {
      const stableHash = await getAmlStableHashFromExistingApi(historyRow.source_record_id);

      return {
        sourceExists: true,
        postgresHash: stableHash,
        hashMethod: 'AML_INTERNAL_STABLE_HASH_API'
      };
    } catch (error) {
      // Fallback below to generic source view recomputation.
    }
  }

  const schemaName = historyRow.source_schema_name || BLOCKCHAIN_SCHEMA;
  const sourceViewName = historyRow.source_view_name;
  const primaryKey = parseSourcePrimaryKey(historyRow.source_primary_key);

  if (!sourceViewName) {
    throw new Error('History row has no source_view_name.');
  }

  const primaryKeyColumns = Object.keys(primaryKey);

  if (!primaryKeyColumns.length) {
    throw new Error('History row has no usable source_primary_key.');
  }

  const whereClause = primaryKeyColumns
    .map((columnName, index) => `${quoteIdent(columnName)}::text = $${index + 1}`)
    .join(' AND ');

  const params = primaryKeyColumns.map((columnName) => String(primaryKey[columnName]));

  const result = await query(
    `
    SELECT *
    FROM ${quoteTable(schemaName, sourceViewName)}
    WHERE ${whereClause}
    LIMIT 1
    `,
    params
  );

  if (!result.rows.length) {
    return {
      sourceExists: false,
      postgresHash: null,
      hashMethod: 'SOURCE_ROW_NOT_FOUND'
    };
  }

  const columnRows = await getTableColumns(sourceViewName);
  const columns = getColumnNames(columnRows);

  return {
    sourceExists: true,
    postgresHash: generateStableHash(result.rows[0], columns),
    hashMethod: 'GENERIC_CANONICAL_SOURCE_HASH'
  };
}

async function getBlockchainHash(historyRow) {
  if (!historyRow.blockchain_transaction_id) {
    return {
      blockchainHash: null,
      blockchainVerificationStatus: 'SKIPPED_NO_BLOCKCHAIN_TRANSACTION_ID',
      blockchainVerificationMessage: 'No blockchain transaction ID exists on the history row.'
    };
  }

  if (!BLOCKCHAIN_VERIFY_ENDPOINT) {
    return {
      blockchainHash: null,
      blockchainVerificationStatus: 'SKIPPED_NO_VERIFY_ENDPOINT',
      blockchainVerificationMessage: 'No blockchain verification endpoint is configured.'
    };
  }

  const response = await httpPostJson(BLOCKCHAIN_VERIFY_ENDPOINT, {
    historyId: String(historyRow.history_id),
    recordType: historyRow.record_type,
    sourceRecordId: historyRow.source_record_id,
    blockchainKey: historyRow.blockchain_key,
    blockchainTransactionId: historyRow.blockchain_transaction_id,
    proofOnly: true
  });

  const blockchainHash = findStableHash(response);

  if (!blockchainHash) {
    throw new Error('Blockchain verification endpoint did not return a blockchain hash.');
  }

  return {
    blockchainHash,
    blockchainVerificationStatus: 'BLOCKCHAIN_HASH_LOADED',
    blockchainVerificationMessage: 'Blockchain hash loaded from configured endpoint.'
  };
}

async function buildVerificationDecision(historyRow) {
  const sourceHashResult = await recomputeSourceHashFromPostgres(historyRow);
  const blockchainHashResult = await getBlockchainHash(historyRow);

  const historyHash = historyRow.new_hash;
  const postgresHash = sourceHashResult.postgresHash;
  const blockchainHash = blockchainHashResult.blockchainHash;

  const sourceExists = sourceHashResult.sourceExists;
  const postgresHashMatchesHistory =
    Boolean(sourceExists && postgresHash && historyHash && postgresHash === historyHash);

  const blockchainHashMatchesHistory =
    blockchainHash ? blockchainHash === historyHash : null;

  const blockchainHashMatchesPostgres =
    blockchainHash && postgresHash ? blockchainHash === postgresHash : null;

  let outcome = 'NOT_VERIFIED';
  let outcomeReason = blockchainHashResult.blockchainVerificationStatus;

  if (!sourceExists || !postgresHashMatchesHistory) {
    outcome = 'FAILED';
    outcomeReason = sourceExists
      ? 'POSTGRES_HASH_MISMATCH'
      : 'SOURCE_ROW_NOT_FOUND';
  } else if (
    blockchainHash &&
    blockchainHashMatchesHistory &&
    blockchainHashMatchesPostgres
  ) {
    outcome = 'VERIFIED';
    outcomeReason = 'POSTGRES_AND_BLOCKCHAIN_HASH_MATCH';
  } else if (blockchainHash && !blockchainHashMatchesHistory) {
    outcome = 'FAILED';
    outcomeReason = 'BLOCKCHAIN_HASH_MISMATCH';
  }

  const verificationStatus = await resolveVerificationStatusValue(outcome);

  return {
    historyId: String(historyRow.history_id),
    recordType: historyRow.record_type,
    sourceRecordId: historyRow.source_record_id,
    blockchainKey: historyRow.blockchain_key,
    blockchainTransactionId: historyRow.blockchain_transaction_id,
    historyHash,
    postgresHash,
    blockchainHash,
    sourceExists,
    postgresHashMatchesHistory,
    blockchainHashMatchesHistory,
    blockchainHashMatchesPostgres,
    verificationOutcome: outcome,
    verificationStatus,
    outcomeReason,
    hashMethod: sourceHashResult.hashMethod,
    blockchainVerificationStatus: blockchainHashResult.blockchainVerificationStatus,
    blockchainVerificationMessage: blockchainHashResult.blockchainVerificationMessage,
    fakeBlockchainSuccess: false
  };
}

async function insertVerificationLog(decision, verifiedBy) {
  const query = resolveQueryClient();
  const columnRows = await getTableColumns(VERIFICATION_TABLE);
  const columns = getColumnNames(columnRows);
  const now = new Date();

  const valuesByColumn = {
    history_id: decision.historyId,
    record_type: decision.recordType,
    source_record_id: decision.sourceRecordId,
    postgres_hash: decision.postgresHash,
    blockchain_hash: decision.blockchainHash,
    blockchain_key: decision.blockchainKey,
    blockchain_transaction_id: decision.blockchainTransactionId,
    hash_match: decision.postgresHashMatchesHistory,
    verification_status: decision.verificationStatus,
    verification_method: 'POSTGRES_SOURCE_HASH_COMPARISON',
    verified_by: verifiedBy,
    verified_at: now,
    error_message: decision.verificationOutcome === 'FAILED'
      ? decision.outcomeReason
      : null,
    metadata: safeJson({
      integrationStep: 'STEP_23_VERIFICATION_LOGIC',
      verificationOutcome: decision.verificationOutcome,
      outcomeReason: decision.outcomeReason,
      sourceExists: decision.sourceExists,
      postgresHashMatchesHistory: decision.postgresHashMatchesHistory,
      blockchainHashMatchesHistory: decision.blockchainHashMatchesHistory,
      blockchainHashMatchesPostgres: decision.blockchainHashMatchesPostgres,
      blockchainVerificationStatus: decision.blockchainVerificationStatus,
      blockchainVerificationMessage: decision.blockchainVerificationMessage,
      blockchainVerifyEndpointConfigured: Boolean(BLOCKCHAIN_VERIFY_ENDPOINT),
      proofOnly: true,
      fakeBlockchainSuccess: false,
      rawSourceRowExcluded: true,
      sensitiveFieldsExcluded: true
    }),
    created_at: now,
    updated_at: now
  };

  const insertColumns = columns.filter(
    (columnName) => valuesByColumn[columnName] !== undefined
  );

  const params = insertColumns.map((columnName) => valuesByColumn[columnName]);
  const placeholders = insertColumns.map((_, index) => `$${index + 1}`);

  const result = await query(
    `
    INSERT INTO ${quoteTable(BLOCKCHAIN_SCHEMA, VERIFICATION_TABLE)}
      (${insertColumns.map(quoteIdent).join(', ')})
    VALUES
      (${placeholders.join(', ')})
    RETURNING verification_id
    `,
    params
  );

  return result.rows[0] ? String(result.rows[0].verification_id) : null;
}

async function updateHistoryVerificationStatus(decision) {
  const query = resolveQueryClient();
  const historyColumns = getColumnNames(await getTableColumns(HISTORY_TABLE));

  const shouldUpdateHistory =
    decision.verificationOutcome === 'VERIFIED' ||
    decision.verificationOutcome === 'FAILED';

  if (!shouldUpdateHistory) {
    return {
      historyUpdated: false,
      reason: 'History verification_status unchanged because blockchain verification is not complete.'
    };
  }

  const valuesByColumn = {
    verification_status: decision.verificationStatus,
    verified_at: new Date(),
    error_message: decision.verificationOutcome === 'FAILED'
      ? decision.outcomeReason
      : null,
    updated_at: new Date()
  };

  const updateColumns = historyColumns.filter(
    (columnName) =>
      columnName !== 'history_id' &&
      valuesByColumn[columnName] !== undefined
  );

  if (!updateColumns.length) {
    return {
      historyUpdated: false,
      reason: 'No compatible history columns found to update.'
    };
  }

  const params = updateColumns.map((columnName) => valuesByColumn[columnName]);
  params.push(decision.historyId);

  const setClause = updateColumns
    .map((columnName, index) => `${quoteIdent(columnName)} = $${index + 1}`)
    .join(', ');

  await query(
    `
    UPDATE ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    SET ${setClause}
    WHERE history_id = $${params.length}::bigint
    `,
    params
  );

  return {
    historyUpdated: true,
    reason: 'History verification status updated.'
  };
}

async function runVerification(options = {}) {
  const recordType = normalizeRecordType(options.recordType);
  const sourceRecordId = options.sourceRecordId || null;
  const limit = normalizeLimit(options.limit);
  const dryRun = normalizeDryRun(options.dryRun);
  const verifiedBy = options.verifiedBy || 'STEP_23_VERIFICATION_API';

  const query = resolveQueryClient();

  const result = await query(
    `
    SELECT
      history_id,
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
      verification_status,
      retry_count,
      created_at,
      updated_at
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    WHERE new_hash IS NOT NULL
      AND ($1::text IS NULL OR record_type = $1)
      AND ($2::text IS NULL OR source_record_id = $2)
    ORDER BY created_at ASC, history_id ASC
    LIMIT $3
    `,
    [recordType, sourceRecordId, limit]
  );

  const decisions = [];

  for (const historyRow of result.rows) {
    try {
      decisions.push(await buildVerificationDecision(historyRow));
    } catch (error) {
      const failedStatus = await resolveVerificationStatusValue('FAILED');

      decisions.push({
        historyId: String(historyRow.history_id),
        recordType: historyRow.record_type,
        sourceRecordId: historyRow.source_record_id,
        blockchainKey: historyRow.blockchain_key,
        blockchainTransactionId: historyRow.blockchain_transaction_id,
        historyHash: historyRow.new_hash,
        postgresHash: null,
        blockchainHash: null,
        sourceExists: false,
        postgresHashMatchesHistory: false,
        blockchainHashMatchesHistory: null,
        blockchainHashMatchesPostgres: null,
        verificationOutcome: 'FAILED',
        verificationStatus: failedStatus,
        outcomeReason: 'VERIFICATION_EXCEPTION',
        errorMessage: error.message,
        fakeBlockchainSuccess: false
      });
    }
  }

  const summary = {
    dryRun,
    recordType: recordType || 'ALL',
    sourceRecordId,
    limit,
    scannedCandidates: decisions.length,
    postgresHashMatchedCount: decisions.filter(
      (item) => item.postgresHashMatchesHistory === true
    ).length,
    blockchainVerifiedCount: decisions.filter(
      (item) => item.verificationOutcome === 'VERIFIED'
    ).length,
    notVerifiedCount: decisions.filter(
      (item) => item.verificationOutcome === 'NOT_VERIFIED'
    ).length,
    failedCount: decisions.filter(
      (item) => item.verificationOutcome === 'FAILED'
    ).length,
    verificationLogsInserted: 0,
    historyRowsUpdated: 0,
    blockchainVerifyEndpointConfigured: Boolean(BLOCKCHAIN_VERIFY_ENDPOINT),
    fakeBlockchainSuccess: false
  };

  if (dryRun) {
    return {
      ...summary,
      decisions
    };
  }

  const writtenDecisions = [];

  for (const decision of decisions) {
    const verificationId = await insertVerificationLog(decision, verifiedBy);
    summary.verificationLogsInserted += verificationId ? 1 : 0;

    const historyUpdateResult = await updateHistoryVerificationStatus(decision);

    if (historyUpdateResult.historyUpdated) {
      summary.historyRowsUpdated += 1;
    }

    writtenDecisions.push({
      ...decision,
      verificationId,
      historyUpdateResult
    });
  }

  return {
    ...summary,
    decisions: writtenDecisions
  };
}

module.exports = {
  getVerificationHealth,
  getVerificationCandidates,
  runVerification
};
