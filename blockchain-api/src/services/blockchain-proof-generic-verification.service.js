'use strict';

const crypto = require('crypto');

const db = require('../config/database');
const fabricService = require('./fabric.service');
const stableHashService = require('./stable-hash-generator.service');

const BLOCKCHAIN_SCHEMA = 'blockchain';
const HISTORY_TABLE = 'blockchain_history';
const VERIFICATION_LOG_TABLE = 'blockchain_verification_logs';

const VERIFICATION_RESULTS = Object.freeze({
  VERIFIED: 'VERIFIED',
  MISMATCH: 'MISMATCH',
  NOT_FOUND: 'NOT_FOUND',
  FAILED: 'FAILED'
});

const HASH_COLUMNS = Object.freeze([
  'record_hash',
  'stable_hash',
  'source_hash',
  'current_hash',
  'hash_sha256',
  'sha256_hash',
  'hash'
]);

const VOLATILE_FIELDS = Object.freeze([
  'created_at',
  'updated_at',
  'submitted_at',
  'verified_at',
  'blockchain_transaction_id',
  'blockchain_status',
  'verification_status',
  'error_message',
  'retry_count',
  'record_hash',
  'hash',
  'hash_version',
  'hash_md5'
]);

const INTERNAL_PROOF_TABLES = Object.freeze([
  'blockchain_history',
  'blockchain_history_attempts',
  'blockchain_sync_history',
  'blockchain_verification_logs',
  'vw_blockchain_history_latest',
  'vw_blockchain_history_retry_queue'
]);

let sourceViewCache = null;

function normalizeText(value) {
  return value === undefined || value === null ? null : String(value).trim();
}

function normalizeModuleName(value) {
  const text = normalizeText(value);

  if (!text) {
    throw new Error('moduleName is required');
  }

  return text.toUpperCase();
}

function normalizeSourceRecordId(value) {
  const text = normalizeText(value);

  if (!text) {
    throw new Error('sourceRecordId is required');
  }

  return text;
}

function normalizeBlockchainKey(value) {
  const text = normalizeText(value);

  if (!text) {
    throw new Error('blockchainKey is required');
  }

  return text;
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

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value.trim());
}

function normalizeHash(value) {
  return isSha256(value) ? value.trim().toLowerCase() : null;
}

function safeJsonParse(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'object' && !Buffer.isBuffer(value)) {
    return value;
  }

  try {
    return JSON.parse(Buffer.isBuffer(value) ? value.toString('utf8') : String(value));
  } catch (error) {
    return null;
  }
}

function canonicalize(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('hex');
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((output, key) => {
        if (!VOLATILE_FIELDS.includes(String(key).toLowerCase())) {
          output[key] = canonicalize(value[key]);
        }

        return output;
      }, {});
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
}

function fallbackStableHash(record) {
  const canonicalJson = JSON.stringify(canonicalize(record));

  return crypto
    .createHash('sha256')
    .update(canonicalJson, 'utf8')
    .digest('hex');
}

function extractHashFromObject(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  for (const columnName of HASH_COLUMNS) {
    const hash = normalizeHash(payload[columnName]);

    if (hash) {
      return hash;
    }
  }

  for (const [key, value] of Object.entries(payload)) {
    if (/hash/i.test(key)) {
      const hash = normalizeHash(value);

      if (hash) {
        return hash;
      }
    }

    if (value && typeof value === 'object') {
      const nestedHash = extractHashFromObject(value);

      if (nestedHash) {
        return nestedHash;
      }
    }
  }

  return null;
}

function generateStableHashFromSourceRow(row) {
  const existingHash = extractHashFromObject(row);

  if (existingHash) {
    return {
      currentHash: existingHash,
      hashMethod: 'SOURCE_VIEW_HASH_COLUMN'
    };
  }

  if (stableHashService && typeof stableHashService.generateRecordHash === 'function') {
    const result = stableHashService.generateRecordHash(row);
    const hash = typeof result === 'string'
      ? normalizeHash(result)
      : extractHashFromObject(result) || normalizeHash(result?.recordHash);

    if (hash) {
      return {
        currentHash: hash,
        hashMethod: 'STABLE_HASH_GENERATOR_SERVICE_GENERATE_RECORD_HASH'
      };
    }
  }

  if (stableHashService && typeof stableHashService.generateStableHash === 'function') {
    const result = stableHashService.generateStableHash(row);
    const hash = typeof result === 'string'
      ? normalizeHash(result)
      : extractHashFromObject(result);

    if (hash) {
      return {
        currentHash: hash,
        hashMethod: 'STABLE_HASH_GENERATOR_SERVICE'
      };
    }
  }

  if (stableHashService && typeof stableHashService.generateHash === 'function') {
    const result = stableHashService.generateHash(row);
    const hash = typeof result === 'string'
      ? normalizeHash(result)
      : extractHashFromObject(result);

    if (hash) {
      return {
        currentHash: hash,
        hashMethod: 'STABLE_HASH_GENERATOR_SERVICE_GENERATE_HASH'
      };
    }
  }

  return {
    currentHash: fallbackStableHash(row),
    hashMethod: 'PHASE_17_FALLBACK_CANONICAL_SHA256'
  };
}

function isNotFoundFabricError(error) {
  const message = String(error && error.message ? error.message : error).toLowerCase();

  return (
    message.includes('not found') ||
    message.includes('does not exist') ||
    message.includes('no proof') ||
    message.includes('missing proof')
  );
}

function extractFabricPayload(rawResult) {
  if (!rawResult) {
    return null;
  }

  if (Buffer.isBuffer(rawResult) || rawResult instanceof Uint8Array) {
    return safeJsonParse(Buffer.from(rawResult).toString('utf8'));
  }

  if (typeof rawResult === 'string') {
    return safeJsonParse(rawResult);
  }

  return rawResult;
}

function buildVerificationResponse(input) {
  return {
    success: input.verificationResult !== VERIFICATION_RESULTS.FAILED,
    verificationResult: input.verificationResult,
    moduleName: input.moduleName || null,
    sourceRecordId: input.sourceRecordId || null,
    blockchainKey: input.blockchainKey || null,
    hashes: {
      postgresHash: input.postgresHash || null,
      blockchainHash: input.blockchainHash || null,
      storedPostgresHash: input.storedPostgresHash || null
    },
    comparison: {
      postgresMatchesBlockchain: input.postgresMatchesBlockchain ?? null,
      postgresMatchesStoredProof: input.postgresMatchesStoredProof ?? null
    },
    blockchain: {
      transactionId: input.blockchainTransactionId || null,
      proofFound: input.blockchainProofFound ?? false
    },
    database: {
      blockchainHistoryId: input.blockchainHistoryId || null,
      verificationId: input.verificationId || null,
      sourceRowFound: input.sourceRowFound ?? false
    },
    message: input.message || null,
    error: input.error || null,
    verifiedBy: input.verifiedBy || null,
    verifiedAt: input.verifiedAt || new Date().toISOString()
  };
}

async function getHistoryByModuleAndSourceRecordId(moduleName, sourceRecordId) {
  const result = await db.query(
    `
    SELECT *
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    WHERE module_name = $1
      AND source_record_id = $2
    ORDER BY created_at DESC, blockchain_history_id DESC
    LIMIT 1
    `,
    [moduleName, sourceRecordId]
  );

  return result.rows[0] || null;
}

async function getHistoryByBlockchainKey(blockchainKey) {
  const result = await db.query(
    `
    SELECT *
    FROM ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    WHERE blockchain_key = $1
    ORDER BY created_at DESC, blockchain_history_id DESC
    LIMIT 1
    `,
    [blockchainKey]
  );

  return result.rows[0] || null;
}

async function getSourceViewCandidates() {
  if (sourceViewCache) {
    return sourceViewCache;
  }

  const result = await db.query(
    `
    SELECT
      table_schema,
      table_name,
      array_agg(column_name ORDER BY ordinal_position) AS columns
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name <> ALL($2::text[])
      AND table_name NOT ILIKE 'vw_blockchain_history%'
      AND table_name NOT ILIKE '%verification_log%'
      AND table_name NOT ILIKE '%history%'
    GROUP BY table_schema, table_name
    HAVING bool_or(column_name = 'source_record_id')
    ORDER BY
      CASE
        WHEN table_name ILIKE 'valoores_%' THEN 1
        WHEN table_name ILIKE '%_sync' THEN 2
        ELSE 3
      END,
      table_name
    `,
    [BLOCKCHAIN_SCHEMA, INTERNAL_PROOF_TABLES]
  );

  sourceViewCache = result.rows.map((row) => ({
    schemaName: row.table_schema,
    tableName: row.table_name,
    columns: row.columns || []
  }));

  return sourceViewCache;
}

async function findCurrentPostgresSourceRow(moduleName, sourceRecordId) {
  const views = await getSourceViewCandidates();

  for (const view of views) {
    const tableRef = quoteTable(view.schemaName, view.tableName);

    const result = await db.query(
      `
      SELECT *
      FROM ${tableRef}
      WHERE source_record_id::text = $1
      LIMIT 1
      `,
      [sourceRecordId]
    ).catch(() => ({ rows: [] }));

    if (!result.rows.length) {
      continue;
    }

    const row = result.rows[0];

    const rowModule =
      row.module_name ||
      row.record_type ||
      row.source_entity ||
      row.source_system ||
      null;

    return {
      sourceRowFound: true,
      sourceView: `${view.schemaName}.${view.tableName}`,
      sourceRowModule: rowModule,
      sourceRow: row
    };
  }

  return {
    sourceRowFound: false,
    sourceView: null,
    sourceRowModule: moduleName,
    sourceRow: null
  };
}

function extractProofData(blockchainProof) {
  if (!blockchainProof || typeof blockchainProof !== 'object') {
    return null;
  }

  return blockchainProof.data && typeof blockchainProof.data === 'object'
    ? blockchainProof.data
    : blockchainProof;
}

function parseSourceViewName(sourceViewName) {
  const text = normalizeText(sourceViewName);

  if (!text || !text.includes('.')) {
    return null;
  }

  const [schemaName, tableName] = text.split('.');

  if (!schemaName || !tableName) {
    return null;
  }

  return {
    schemaName,
    tableName
  };
}

async function findCurrentPostgresSourceRowFromFabricProof(proofData) {
  const metadata = proofData?.metadata || {};
  const sourceView = parseSourceViewName(metadata.sourceViewName);

  if (!sourceView) {
    return findCurrentPostgresSourceRow(
      proofData?.recordType || proofData?.moduleName || null,
      proofData?.sourceRecordId || null
    );
  }

  const sourcePrimaryKey = metadata.sourcePrimaryKey || {};
  const sourcePrimaryKeyColumns = Array.isArray(metadata.sourcePrimaryKeyColumns)
    ? metadata.sourcePrimaryKeyColumns
    : Object.keys(sourcePrimaryKey);

  const safeColumns = sourcePrimaryKeyColumns.filter((columnName) => {
    return sourcePrimaryKey[columnName] !== undefined && sourcePrimaryKey[columnName] !== null;
  });

  if (!safeColumns.length) {
    return findCurrentPostgresSourceRow(
      proofData?.recordType || proofData?.moduleName || null,
      proofData?.sourceRecordId || null
    );
  }

  const tableRef = quoteTable(sourceView.schemaName, sourceView.tableName);

  const whereClause = safeColumns
    .map((columnName, index) => `${quoteIdent(columnName)}::text = $${index + 1}`)
    .join(' AND ');

  const values = safeColumns.map((columnName) => String(sourcePrimaryKey[columnName]));

  const result = await db.query(
    `
    SELECT *
    FROM ${tableRef}
    WHERE ${whereClause}
    LIMIT 1
    `,
    values
  ).catch(() => ({ rows: [] }));

  if (!result.rows.length) {
    return {
      sourceRowFound: false,
      sourceView: `${sourceView.schemaName}.${sourceView.tableName}`,
      sourceRowModule: proofData?.recordType || proofData?.moduleName || null,
      sourceRow: null
    };
  }

  return {
    sourceRowFound: true,
    sourceView: `${sourceView.schemaName}.${sourceView.tableName}`,
    sourceRowModule: proofData?.recordType || proofData?.moduleName || null,
    sourceRow: result.rows[0]
  };
}

async function verifyFabricOnlyBlockchainProof(blockchainKey, options = {}) {
  const verifiedBy = options.verifiedBy || 'phase-17-generic-verification-service';

  const fabricResult = await readBlockchainProof(blockchainKey);

  if (!fabricResult.blockchainProofFound) {
    const response = buildVerificationResponse({
      verificationResult: VERIFICATION_RESULTS.NOT_FOUND,
      blockchainKey,
      blockchainProofFound: false,
      message: 'No PostgreSQL blockchain history record or Hyperledger Fabric proof was found for this blockchain key.',
      error: fabricResult.error,
      verifiedBy
    });

    response.database.verificationId = await insertVerificationLog(response);

    return response;
  }

  const proofData = extractProofData(fabricResult.blockchainProof);
  const moduleName = proofData?.recordType || proofData?.moduleName || null;
  const sourceRecordId = proofData?.sourceRecordId || null;
  const blockchainHash = normalizeHash(proofData?.stableHash) || fabricResult.blockchainHash;
  const blockchainTransactionId = proofData?.txId || proofData?.transactionId || null;

  const sourceResult = await findCurrentPostgresSourceRowFromFabricProof(proofData);

  if (!sourceResult.sourceRowFound) {
    const response = buildVerificationResponse({
      verificationResult: VERIFICATION_RESULTS.NOT_FOUND,
      moduleName,
      sourceRecordId,
      blockchainKey,
      blockchainHash,
      blockchainTransactionId,
      blockchainProofFound: true,
      sourceRowFound: false,
      message: 'Hyperledger Fabric proof was found, but the current PostgreSQL source row was not found.',
      verifiedBy
    });

    response.database.verificationId = await insertVerificationLog(response);
    response.database.sourceView = sourceResult.sourceView;

    return response;
  }

  const currentHashResult = generateStableHashFromSourceRow(sourceResult.sourceRow);
  const postgresHash = currentHashResult.currentHash;

  const postgresMatchesBlockchain = Boolean(
    postgresHash &&
    blockchainHash &&
    postgresHash === blockchainHash
  );

  const verificationResult = postgresMatchesBlockchain
    ? VERIFICATION_RESULTS.VERIFIED
    : VERIFICATION_RESULTS.MISMATCH;

  const response = buildVerificationResponse({
    verificationResult,
    moduleName,
    sourceRecordId,
    blockchainKey,
    postgresHash,
    blockchainHash,
    postgresMatchesBlockchain,
    postgresMatchesStoredProof: null,
    blockchainTransactionId,
    blockchainProofFound: true,
    sourceRowFound: true,
    message: postgresMatchesBlockchain
      ? 'Current PostgreSQL hash matches the Hyperledger Fabric proof hash.'
      : 'Current PostgreSQL hash does not match the Hyperledger Fabric proof hash.',
    verifiedBy
  });

  response.hashes.hashMethod = currentHashResult.hashMethod;
  response.database.sourceView = sourceResult.sourceView;
  response.database.verificationId = await insertVerificationLog(response);

  return response;
}

async function readBlockchainProof(blockchainKey) {
  try {
    const rawResult = await fabricService.evaluateTransaction('GetProof', [blockchainKey], {
      service: 'phase-17-generic-verification',
      operation: 'GetProof'
    });

    const proof = extractFabricPayload(rawResult);
    const blockchainHash = extractHashFromObject(proof);

    return {
      blockchainProofFound: true,
      blockchainProof: proof,
      blockchainHash,
      error: null
    };
  } catch (error) {
    if (isNotFoundFabricError(error)) {
      return {
        blockchainProofFound: false,
        blockchainProof: null,
        blockchainHash: null,
        error: error.message
      };
    }

    throw error;
  }
}

async function insertVerificationLog(response) {
  const postgresHashForLog =
    response.hashes.postgresHash ||
    response.hashes.storedPostgresHash ||
    response.verificationResult;

  const result = await db.query(
    `
    INSERT INTO ${quoteTable(BLOCKCHAIN_SCHEMA, VERIFICATION_LOG_TABLE)}
      (
        history_id,
        record_type,
        source_record_id,
        postgres_hash,
        blockchain_hash,
        blockchain_key,
        blockchain_transaction_id,
        verification_status,
        verified_by,
        error_message,
        metadata
      )
    VALUES
      (
        NULL,
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10::jsonb
      )
    RETURNING verification_id
    `,
    [
      response.moduleName || 'UNKNOWN',
      response.sourceRecordId || 'UNKNOWN',
      postgresHashForLog,
      response.hashes.blockchainHash,
      response.blockchainKey,
      response.blockchain.transactionId,
      response.verificationResult,
      response.verifiedBy || 'phase-17-generic-verification-service',
      response.error || response.message,
      JSON.stringify({
        phase: 'PHASE_17',
        service: 'blockchain-proof-generic-verification.service.js',
        blockchainHistoryId: response.database.blockchainHistoryId,
        sourceRowFound: response.database.sourceRowFound,
        blockchainProofFound: response.blockchain.proofFound,
        comparison: response.comparison,
        hashes: response.hashes
      })
    ]
  );

  return result.rows[0] ? String(result.rows[0].verification_id) : null;
}

async function updateBlockchainHistoryVerificationStatus(blockchainHistoryId, verificationResult, errorMessage = null) {
  if (!blockchainHistoryId) {
    return false;
  }

  await db.query(
    `
    UPDATE ${quoteTable(BLOCKCHAIN_SCHEMA, HISTORY_TABLE)}
    SET
      verification_status = $2,
      verified_at = CURRENT_TIMESTAMP,
      error_message = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE blockchain_history_id = $1
    `,
    [blockchainHistoryId, verificationResult, errorMessage]
  );

  return true;
}

async function verifyHistoryRow(historyRow, options = {}) {
  const verifiedBy = options.verifiedBy || 'phase-17-generic-verification-service';

  const moduleName = historyRow.module_name;
  const sourceRecordId = historyRow.source_record_id;
  const blockchainKey = historyRow.blockchain_key;
  const storedPostgresHash = normalizeHash(historyRow.record_hash);

  const sourceResult = await findCurrentPostgresSourceRow(moduleName, sourceRecordId);

  if (!sourceResult.sourceRowFound) {
    const response = buildVerificationResponse({
      verificationResult: VERIFICATION_RESULTS.NOT_FOUND,
      moduleName,
      sourceRecordId,
      blockchainKey,
      storedPostgresHash,
      blockchainTransactionId: historyRow.blockchain_transaction_id,
      blockchainHistoryId: String(historyRow.blockchain_history_id),
      sourceRowFound: false,
      blockchainProofFound: false,
      message: 'Current PostgreSQL source row was not found.',
      verifiedBy
    });

    response.database.verificationId = await insertVerificationLog(response);
    await updateBlockchainHistoryVerificationStatus(
      historyRow.blockchain_history_id,
      VERIFICATION_RESULTS.NOT_FOUND,
      response.message
    );

    return response;
  }

  const currentHashResult = generateStableHashFromSourceRow(sourceResult.sourceRow);
  const postgresHash = currentHashResult.currentHash;

  const fabricResult = await readBlockchainProof(blockchainKey);

  if (!fabricResult.blockchainProofFound) {
    const response = buildVerificationResponse({
      verificationResult: VERIFICATION_RESULTS.NOT_FOUND,
      moduleName,
      sourceRecordId,
      blockchainKey,
      postgresHash,
      storedPostgresHash,
      blockchainTransactionId: historyRow.blockchain_transaction_id,
      blockchainHistoryId: String(historyRow.blockchain_history_id),
      sourceRowFound: true,
      blockchainProofFound: false,
      message: 'Blockchain proof was not found on Hyperledger Fabric.',
      error: fabricResult.error,
      verifiedBy
    });

    response.database.verificationId = await insertVerificationLog(response);
    await updateBlockchainHistoryVerificationStatus(
      historyRow.blockchain_history_id,
      VERIFICATION_RESULTS.NOT_FOUND,
      response.message
    );

    return response;
  }

  const blockchainHash = fabricResult.blockchainHash;
  const postgresMatchesBlockchain = Boolean(
    postgresHash &&
    blockchainHash &&
    postgresHash === blockchainHash
  );

  const postgresMatchesStoredProof = Boolean(
    postgresHash &&
    storedPostgresHash &&
    postgresHash === storedPostgresHash
  );

  const verificationResult = postgresMatchesBlockchain
    ? VERIFICATION_RESULTS.VERIFIED
    : VERIFICATION_RESULTS.MISMATCH;

  const response = buildVerificationResponse({
    verificationResult,
    moduleName,
    sourceRecordId,
    blockchainKey,
    postgresHash,
    blockchainHash,
    storedPostgresHash,
    postgresMatchesBlockchain,
    postgresMatchesStoredProof,
    blockchainTransactionId: historyRow.blockchain_transaction_id,
    blockchainHistoryId: String(historyRow.blockchain_history_id),
    sourceRowFound: true,
    blockchainProofFound: true,
    message: postgresMatchesBlockchain
      ? 'Current PostgreSQL hash matches the Hyperledger Fabric proof hash.'
      : 'Current PostgreSQL hash does not match the Hyperledger Fabric proof hash.',
    verifiedBy
  });

  response.database.verificationId = await insertVerificationLog(response);
  await updateBlockchainHistoryVerificationStatus(
    historyRow.blockchain_history_id,
    verificationResult,
    verificationResult === VERIFICATION_RESULTS.MISMATCH ? response.message : null
  );

  response.database.sourceView = sourceResult.sourceView;
  response.hashes.hashMethod = currentHashResult.hashMethod;

  return response;
}

async function verifyByModuleAndSourceRecordId(input = {}) {
  const moduleName = normalizeModuleName(input.moduleName || input.module);
  const sourceRecordId = normalizeSourceRecordId(input.sourceRecordId || input.source_record_id);
  const verifiedBy = input.verifiedBy || 'phase-17-generic-verification-service';

  try {
    const historyRow = await getHistoryByModuleAndSourceRecordId(moduleName, sourceRecordId);

    if (!historyRow) {
      const response = buildVerificationResponse({
        verificationResult: VERIFICATION_RESULTS.NOT_FOUND,
        moduleName,
        sourceRecordId,
        message: 'No PostgreSQL blockchain history record was found for this module and source record ID.',
        verifiedBy
      });

      response.database.verificationId = await insertVerificationLog(response);

      return response;
    }

    return await verifyHistoryRow(historyRow, { verifiedBy });
  } catch (error) {
    const response = buildVerificationResponse({
      verificationResult: VERIFICATION_RESULTS.FAILED,
      moduleName,
      sourceRecordId,
      message: 'Blockchain verification failed.',
      error: error.message,
      verifiedBy
    });

    response.database.verificationId = await insertVerificationLog(response).catch(() => null);

    return response;
  }
}

async function verifyByBlockchainKey(input = {}) {
  const blockchainKey = normalizeBlockchainKey(input.blockchainKey || input.blockchain_key);
  const verifiedBy = input.verifiedBy || 'phase-17-generic-verification-service';

  try {
    const historyRow = await getHistoryByBlockchainKey(blockchainKey);

    if (!historyRow) {
      return await verifyFabricOnlyBlockchainProof(blockchainKey, { verifiedBy });
    }

    return await verifyHistoryRow(historyRow, { verifiedBy });
  } catch (error) {
    const response = buildVerificationResponse({
      verificationResult: VERIFICATION_RESULTS.FAILED,
      blockchainKey,
      message: 'Blockchain verification failed.',
      error: error.message,
      verifiedBy
    });

    response.database.verificationId = await insertVerificationLog(response).catch(() => null);

    return response;
  }
}

module.exports = {
  VERIFICATION_RESULTS,
  buildVerificationResponse,
  verifyByModuleAndSourceRecordId,
  verifyByBlockchainKey
};
