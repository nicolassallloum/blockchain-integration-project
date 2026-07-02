'use strict';

const crypto = require('crypto');
const db = require('../config/database');
const fabricService = require('./fabric.service');

const SOURCE_VIEW = 'blockchain.valoores_aml_rules';
const TARGET_CHAINCODE_FUNCTION = 'SaveAmlRule';

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  return `{${Object.keys(value).sort().map((key) => {
    return `${JSON.stringify(key)}:${stableStringify(value[key])}`;
  }).join(',')}}`;
}

function hashPayload(payload) {
  return crypto
    .createHash('sha256')
    .update(stableStringify(payload))
    .digest('hex');
}

function normalizeLimit(value, defaultLimit = 1000, maxLimit = 5000) {
  const parsed = Number(value || defaultLimit);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit;
  }

  return Math.min(Math.floor(parsed), maxLimit);
}

function getRuleId(row) {
  return String(row['RULE ID'] || '').trim();
}

function getRuleQueryId(row) {
  return String(row['RULE QUERY ID'] || row.ruleQueryId || row.rule_query_id || '0').trim();
}

function getRuleKey(row) {
  const ruleId = getRuleId(row);
  const ruleQueryId = getRuleQueryId(row);
  return `AML_RULE_${ruleId}_${ruleQueryId || '0'}`;
}

async function ensureSyncTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS blockchain.valoores_aml_rules_fabric_sync (
      sync_id BIGSERIAL PRIMARY KEY,
      rule_key TEXT UNIQUE NOT NULL,
      rule_id TEXT NOT NULL,
      rule_query_id TEXT NULL,
      source_view TEXT NOT NULL DEFAULT 'blockchain.valoores_aml_rules',
      source_hash TEXT NOT NULL,
      source_payload JSONB NOT NULL,
      fabric_tx_id TEXT NULL,
      sync_status TEXT NOT NULL DEFAULT 'PENDING',
      fabric_status TEXT NOT NULL DEFAULT 'PENDING',
      error_message TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_submitted_at TIMESTAMPTZ NULL
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_valoores_aml_rules_fabric_sync_status
    ON blockchain.valoores_aml_rules_fabric_sync(sync_status, fabric_status);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_valoores_aml_rules_fabric_sync_rule_id
    ON blockchain.valoores_aml_rules_fabric_sync(rule_id);
  `);
}

function getSourceSql(limit) {
  return `
    SELECT
      rule_id::text AS "RULE ID",
      rule_desc_normalized::text AS "RULE DESC",
      rule_status_code::text AS "RULE STATUS",
      rule_start_date::text AS "RULE START DATE",
      rule_expiry_date::text AS "RULE EXPIRY DATE",
      rule_creation_ts_utc::text AS "RULE CREATION DATE",
      NULL::text AS "RULE CREATOR",
      rule_update_ts_utc::text AS "RULE UPDATE DATE",
      NULL::text AS "RULE UPDATOR",
      rule_message_normalized::text AS "RULE MESSAGE",
      rule_query_id::text AS "RULE QUERY ID",
      rule_logic_fingerprint::text AS "RULE SQL QUERY",
      rule_logic_created_date::text AS "RULE QUERY CREATION DATE",
      NULL::text AS "RULE QUERY CREATED BY",
      rule_query_id::text AS "RULE APPLCIATION QUERY ID",
      rule_logic_updated_date::text AS "RULE QUERY UPDATE DATE",
      NULL::text AS "RULE QUERY UPDATE BY"
    FROM blockchain.valoores_aml_rules
    ORDER BY rule_id, rule_query_id
    LIMIT ${limit};
  `;
}

async function getSourceRecords(limit = 1000) {
  const safeLimit = normalizeLimit(limit, 1000, 5000);
  const result = await db.query(getSourceSql(safeLimit));
  return result.rows;
}

async function getSyncSummary() {
  await ensureSyncTable();

  const result = await db.query(`
    SELECT
      COUNT(*)::int AS total_tracked,
      COUNT(*) FILTER (WHERE sync_status = 'SYNCED')::int AS synced,
      COUNT(*) FILTER (WHERE sync_status = 'SKIPPED')::int AS skipped,
      COUNT(*) FILTER (WHERE sync_status = 'FAILED')::int AS failed,
      MAX(updated_at) AS last_updated_at,
      MAX(last_submitted_at) AS last_submitted_at
    FROM blockchain.valoores_aml_rules_fabric_sync;
  `);

  return result.rows[0] || {};
}

async function syncValooresAmlRules(options = {}) {
  await ensureSyncTable();

  const limit = normalizeLimit(options.limit, 1000, 5000);
  const force = Boolean(options.force);
  const createdBy = options.createdBy || 'system';
  const requestId = options.requestId || null;
  const correlationId = options.correlationId || requestId;

  const rows = await getSourceRecords(limit);

  const synced = [];
  const skipped = [];
  const failed = [];

  for (const row of rows) {
    const ruleId = getRuleId(row);

    if (!ruleId) {
      failed.push({
        ruleId: null,
        key: null,
        error: 'RULE ID is missing'
      });
      continue;
    }

    const ruleKey = getRuleKey(row);
    const sourceHash = hashPayload(row);

    const existing = await db.query(
      `
      SELECT rule_key, source_hash, sync_status
      FROM blockchain.valoores_aml_rules_fabric_sync
      WHERE rule_key = $1
      LIMIT 1;
      `,
      [ruleKey]
    );

    if (
      !force &&
      existing.rows[0] &&
      existing.rows[0].source_hash === sourceHash &&
      existing.rows[0].sync_status === 'SYNCED'
    ) {
      skipped.push({
        ruleId,
        key: ruleKey,
        reason: 'NO_CHANGE'
      });
      continue;
    }

    try {
      await db.query(
        `
        INSERT INTO blockchain.valoores_aml_rules_fabric_sync (
          rule_key,
          rule_id,
          rule_query_id,
          source_view,
          source_hash,
          source_payload,
          sync_status,
          fabric_status,
          error_message,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'PENDING', 'PENDING', NULL, NOW())
        ON CONFLICT (rule_key)
        DO UPDATE SET
          rule_id = EXCLUDED.rule_id,
          rule_query_id = EXCLUDED.rule_query_id,
          source_view = EXCLUDED.source_view,
          source_hash = EXCLUDED.source_hash,
          source_payload = EXCLUDED.source_payload,
          sync_status = 'PENDING',
          fabric_status = 'PENDING',
          error_message = NULL,
          updated_at = NOW();
        `,
        [
          ruleKey,
          ruleId,
          getRuleQueryId(row) || null,
          SOURCE_VIEW,
          sourceHash,
          JSON.stringify(row)
        ]
      );

      const fabricResult = await fabricService.submitTransaction(
        TARGET_CHAINCODE_FUNCTION,
        [JSON.stringify(row)],
        {
          requestId,
          correlationId,
          sourceSystem: 'POSTGRESQL_VIEW',
          requestSource: 'VALOORES_AML_RULES_AUTO_SYNC',
          createdBy
        }
      );

      const txId =
        fabricResult.txId ||
        fabricResult.transactionId ||
        fabricResult.blockchainTxId ||
        null;

      await db.query(
        `
        UPDATE blockchain.valoores_aml_rules_fabric_sync
        SET
          fabric_tx_id = $2,
          sync_status = 'SYNCED',
          fabric_status = 'CONFIRMED',
          error_message = NULL,
          updated_at = NOW(),
          last_submitted_at = NOW()
        WHERE rule_key = $1;
        `,
        [ruleKey, txId]
      );

      synced.push({
        ruleId,
        key: ruleKey,
        txId,
        status: 'SYNCED'
      });
    } catch (error) {
      await db.query(
        `
        UPDATE blockchain.valoores_aml_rules_fabric_sync
        SET
          sync_status = 'FAILED',
          fabric_status = 'FAILED',
          error_message = $2,
          updated_at = NOW()
        WHERE rule_key = $1;
        `,
        [ruleKey, error.message]
      );

      failed.push({
        ruleId,
        key: ruleKey,
        status: 'FAILED',
        error: error.message
      });
    }
  }

  return {
    source: SOURCE_VIEW,
    target: 'Fabric/CouchDB',
    chaincodeFunction: TARGET_CHAINCODE_FUNCTION,
    limit,
    force,
    totalSourceRecords: rows.length,
    syncedCount: synced.length,
    skippedCount: skipped.length,
    failedCount: failed.length,
    synced,
    skipped,
    failed,
    summary: await getSyncSummary()
  };
}

let schedulerStarted = false;
let schedulerTimer = null;
let schedulerRunning = false;

function startAutoSyncScheduler() {
  if (schedulerStarted) {
    return;
  }

  const enabled = String(process.env.VALOORES_AML_RULES_AUTO_SYNC_ENABLED || 'true').toLowerCase() !== 'false';
  const intervalMs = Number(process.env.VALOORES_AML_RULES_AUTO_SYNC_INTERVAL_MS || 60000);
  const limit = Number(process.env.VALOORES_AML_RULES_AUTO_SYNC_LIMIT || 1000);

  if (!enabled) {
    console.log('[VALOORES_AML_RULES_AUTO_SYNC] Disabled by env.');
    return;
  }

  schedulerStarted = true;

  const runOnce = async () => {
    if (schedulerRunning) {
      return;
    }

    schedulerRunning = true;

    try {
      const result = await syncValooresAmlRules({
        limit,
        force: false,
        createdBy: 'auto-sync-scheduler'
      });

      if (result.syncedCount > 0 || result.failedCount > 0) {
        console.log('[VALOORES_AML_RULES_AUTO_SYNC_RESULT]', {
          totalSourceRecords: result.totalSourceRecords,
          syncedCount: result.syncedCount,
          skippedCount: result.skippedCount,
          failedCount: result.failedCount
        });
      }
    } catch (error) {
      console.error('[VALOORES_AML_RULES_AUTO_SYNC_ERROR]', error.message);
    } finally {
      schedulerRunning = false;
    }
  };

  schedulerTimer = setInterval(runOnce, intervalMs);
  setTimeout(runOnce, 10000);

  console.log('[VALOORES_AML_RULES_AUTO_SYNC] Started', {
    intervalMs,
    limit
  });
}

function stopAutoSyncScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }

  schedulerStarted = false;
}

module.exports = {
  SOURCE_VIEW,
  TARGET_CHAINCODE_FUNCTION,
  ensureSyncTable,
  getSourceRecords,
  getSyncSummary,
  syncValooresAmlRules,
  startAutoSyncScheduler,
  stopAutoSyncScheduler
};
