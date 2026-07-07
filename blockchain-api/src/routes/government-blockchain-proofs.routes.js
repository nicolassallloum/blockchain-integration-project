const express = require('express');
const { Pool } = require('pg');
const dashboardController = require('../controllers/blockchain-proof-dashboard.controller');

const router = express.Router();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || process.env.DB_PORT || 5432),
  database:
    process.env.POSTGRES_DB ||
    process.env.POSTGRES_DATABASE ||
    process.env.DB_NAME ||
    'vfds_dev',
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
  ssl:
    String(process.env.POSTGRES_SSL || 'false').toLowerCase() === 'true'
      ? { rejectUnauthorized: false }
      : false
});

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return 100;
  }

  return Math.min(Math.max(parsed, 1), 500);
}

function normalizeOffset(value) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.max(parsed, 0);
}

function addFilter(filters, values, sqlCondition, value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return;
  }

  values.push(value);
  filters.push(sqlCondition.replace('?', `$${values.length}`));
}


/**
 * GET /api/v1/government-blockchain/blockchain-proofs/dashboard/audit-metrics
 */
router.get('/dashboard/audit-metrics', dashboardController.auditMetrics);

/**
 * GET /api/v1/government-blockchain/blockchain-proofs/dashboard/audit-report/export
 */
router.get('/dashboard/audit-report/export', dashboardController.auditReportExport);


/**
 * GET /api/v1/government-blockchain/blockchain-proofs/summary
 */
router.get('/summary', async (req, res) => {
  const query = `
    WITH proofs AS (
      SELECT
        COALESCE(blockchain_status, wallet_status, 'UNKNOWN') AS blockchain_status
      FROM blockchain.government_ministry_wallets
      WHERE COALESCE(tx_id, ledger_reference, blockchain_status) IS NOT NULL

      UNION ALL

      SELECT
        COALESCE(blockchain_status, wallet_status, 'UNKNOWN') AS blockchain_status
      FROM blockchain.resident_wallets
      WHERE COALESCE(fabric_tx_id, blockchain_status) IS NOT NULL

      UNION ALL

      SELECT
        COALESCE(blockchain_status, transaction_status, 'UNKNOWN') AS blockchain_status
      FROM blockchain.government_transactions
      WHERE COALESCE(blockchain_tx_id, blockchain_status) IS NOT NULL

      UNION ALL

      SELECT
        COALESCE(status, 'DOCUMENT_HASHED') AS blockchain_status
      FROM blockchain.transaction_documents
      WHERE COALESCE(document_hash, status) IS NOT NULL

      UNION ALL

      SELECT
        COALESCE(stamp_status, payment_status, 'UNKNOWN') AS blockchain_status
      FROM blockchain.digital_stamp_payments
      WHERE COALESCE(stamp_id, payment_ref, stamp_status, payment_status) IS NOT NULL
    )
    SELECT
      COUNT(*)::int AS total_proofs,
      COUNT(*) FILTER (
        WHERE UPPER(blockchain_status) IN ('CONFIRMED', 'SYNCED', 'VERIFIED', 'ACTIVE', 'ISSUED', 'REDEEMED')
      )::int AS verified_confirmed,
      COUNT(*) FILTER (
        WHERE UPPER(blockchain_status) IN ('PENDING', 'NOT_SUBMITTED', 'NOT SUBMITTED', 'DOCUMENT_HASHED')
      )::int AS pending,
      COUNT(*) FILTER (
        WHERE UPPER(blockchain_status) IN ('FAILED', 'INVALID', 'BLOCKCHAIN FAILED', 'NOT ISSUED')
      )::int AS failed_invalid
    FROM proofs;
  `;

  try {
    const result = await pool.query(query);
    const row = result.rows[0] || {};

    return res.json({
      success: true,
      message: 'Blockchain proofs summary loaded successfully.',
      data: {
        totalProofs: Number(row.total_proofs || 0),
        verifiedConfirmed: Number(row.verified_confirmed || 0),
        pending: Number(row.pending || 0),
        failedInvalid: Number(row.failed_invalid || 0)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[BLOCKCHAIN PROOFS SUMMARY ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load blockchain proofs summary.',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});


/**
 * GET /api/v1/government-blockchain/blockchain-proofs
 *
 * Supported filters:
 * - entityType
 * - entityId
 * - blockchainStatus
 * - dateFrom
 * - dateTo
 * - limit
 * - offset
 */
router.get('/', async (req, res) => {
  const {
    entityType,
    entityId,
    blockchainStatus,
    dateFrom,
    dateTo
  } = req.query;

  const limit = normalizeLimit(req.query.limit);
  const offset = normalizeOffset(req.query.offset);

  const values = [];
  const filters = [];

  addFilter(filters, values, 'proofs.entity_type = ?', entityType);
  addFilter(filters, values, 'proofs.entity_id ILIKE ?', entityId ? `%${entityId}%` : '');
  addFilter(filters, values, 'proofs.blockchain_status ILIKE ?', blockchainStatus ? `%${blockchainStatus}%` : '');
  addFilter(filters, values, 'proofs.submitted_date::date >= ?::date', dateFrom);
  addFilter(filters, values, 'proofs.submitted_date::date <= ?::date', dateTo);

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  values.push(limit);
  const limitParam = `$${values.length}`;

  values.push(offset);
  const offsetParam = `$${values.length}`;

  const query = `
    WITH proofs AS (
      SELECT
        CONCAT('PROOF-WALLET-MINISTRY-', wallet_id::text) AS proof_id,
        'Wallet Creation Proof'::text AS proof_type,
        'MINISTRY_WALLET'::text AS entity_type,
        wallet_id::text AS entity_id,
        COALESCE(tx_id, ledger_reference) AS blockchain_transaction_hash,
        COALESCE(blockchain_status, wallet_status, 'UNKNOWN') AS blockchain_status,
        created_at AS submitted_date,
        NULL::text AS created_by,
        ledger_reference AS couchdb_document_id,
        'government_ministry_wallets'::text AS source_table
      FROM blockchain.government_ministry_wallets
      WHERE COALESCE(tx_id, ledger_reference, blockchain_status) IS NOT NULL

      UNION ALL

      SELECT
        CONCAT('PROOF-WALLET-RESIDENT-', id::text) AS proof_id,
        'Wallet Creation Proof'::text AS proof_type,
        'RESIDENT_WALLET'::text AS entity_type,
        COALESCE(resident_id, id::text) AS entity_id,
        fabric_tx_id AS blockchain_transaction_hash,
        COALESCE(blockchain_status, wallet_status, 'UNKNOWN') AS blockchain_status,
        created_at AS submitted_date,
        NULL::text AS created_by,
        NULL::text AS couchdb_document_id,
        'resident_wallets'::text AS source_table
      FROM blockchain.resident_wallets
      WHERE COALESCE(fabric_tx_id, blockchain_status) IS NOT NULL

      UNION ALL

      SELECT
        CONCAT('PROOF-TXN-', transaction_id::text) AS proof_id,
        'Transaction Approval Proof'::text AS proof_type,
        'GOVERNMENT_TRANSACTION'::text AS entity_type,
        COALESCE(transaction_reference, transaction_id::text) AS entity_id,
        blockchain_tx_id AS blockchain_transaction_hash,
        COALESCE(blockchain_status, transaction_status, 'UNKNOWN') AS blockchain_status,
        COALESCE(blockchain_submitted_at, updated_at, created_at) AS submitted_date,
        COALESCE(created_by_login_username, created_by_account_type, created_by_wallet_address) AS created_by,
        blockchain_tx_id AS couchdb_document_id,
        'government_transactions'::text AS source_table
      FROM blockchain.government_transactions
      WHERE COALESCE(blockchain_tx_id, blockchain_status) IS NOT NULL

      UNION ALL

      SELECT
        CONCAT('PROOF-DOC-', id::text) AS proof_id,
        'Document Verification Proof'::text AS proof_type,
        'TRANSACTION_DOCUMENT'::text AS entity_type,
        COALESCE(transaction_reference, transaction_id::text, id::text) AS entity_id,
        document_hash AS blockchain_transaction_hash,
        COALESCE(status, 'DOCUMENT_HASHED') AS blockchain_status,
        COALESCE(updated_at, created_at) AS submitted_date,
        uploaded_by AS created_by,
        document_hash AS couchdb_document_id,
        'transaction_documents'::text AS source_table
      FROM blockchain.transaction_documents
      WHERE COALESCE(document_hash, status) IS NOT NULL

      UNION ALL

      SELECT
        CONCAT('PROOF-STAMP-', id::text) AS proof_id,
        'Digital Stamp Proof'::text AS proof_type,
        'DIGITAL_STAMP'::text AS entity_type,
        COALESCE(stamp_id, payment_ref, id::text) AS entity_id,
        COALESCE(stamp_id, payment_ref) AS blockchain_transaction_hash,
        COALESCE(stamp_status, payment_status, 'UNKNOWN') AS blockchain_status,
        created_at AS submitted_date,
        resident_name AS created_by,
        COALESCE(stamp_id, payment_ref) AS couchdb_document_id,
        'digital_stamp_payments'::text AS source_table
      FROM blockchain.digital_stamp_payments
      WHERE COALESCE(stamp_id, payment_ref, stamp_status, payment_status) IS NOT NULL
    ),
    filtered AS (
      SELECT *
      FROM proofs
      ${whereClause}
    )
    SELECT
      proof_id AS "proofId",
      proof_type AS "proofType",
      entity_type AS "entityType",
      entity_id AS "entityId",
      blockchain_transaction_hash AS "blockchainTransactionHash",
      blockchain_status AS "blockchainStatus",
      submitted_date AS "submittedDate",
      created_by AS "createdBy",
      couchdb_document_id AS "couchDbDocumentId",
      source_table AS "sourceTable",
      COUNT(*) OVER()::int AS "totalCount"
    FROM filtered
    ORDER BY submitted_date DESC NULLS LAST, proof_id DESC
    LIMIT ${limitParam}
    OFFSET ${offsetParam};
  `;

  try {
    const result = await pool.query(query, values);
    const total = result.rows.length > 0 ? result.rows[0].totalCount : 0;

    const data = result.rows.map((row) => {
      const { totalCount, ...cleanRow } = row;
      return cleanRow;
    });

    return res.json({
      success: true,
      message: 'Blockchain proofs retrieved successfully.',
      data,
      meta: {
        total,
        limit,
        offset,
        filters: {
          entityType: entityType || null,
          entityId: entityId || null,
          blockchainStatus: blockchainStatus || null,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[BLOCKCHAIN PROOFS ROUTE ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve blockchain proofs.',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
