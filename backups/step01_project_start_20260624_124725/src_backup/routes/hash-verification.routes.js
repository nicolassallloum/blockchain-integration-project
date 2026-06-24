'use strict';

const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');

const router = express.Router();

function getPoolConfig() {
  return {
    host: process.env.PGHOST || process.env.DB_HOST || '172.31.13.133',
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5444),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'vfds_dev',
    user: process.env.PGUSER || process.env.DB_USER || 'pgdata',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'pgdata@Valoores05',
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT || 10000)
  };
}

const pool = new Pool(getPoolConfig());

function normalizeHash(value) {
  return String(value || '').trim();
}

function isValidHashInput(hash) {
  return typeof hash === 'string' && hash.trim().length >= 8 && hash.trim().length <= 512;
}

function cleanDate(value) {
  if (!value) {
    return null;
  }

  try {
    return new Date(value).toISOString();
  } catch (error) {
    return value;
  }
}

function buildVerifiedResponse(row) {
  return {
    verificationStatus: 'VERIFIED',
    verified: true,
    found: true,
    source: row.source,
    entityType: row.entity_type,
    entityId: row.entity_id,
    hash: row.hash,
    blockchainStatus: row.blockchain_status || 'UNKNOWN',
    createdDate: cleanDate(row.created_date),
    relatedProof: row.related_proof || null,
    details: row.details || {}
  };
}

function buildNotFoundResponse(hash, couchdbResult = null) {
  return {
    verificationStatus: 'NOT_FOUND',
    verified: false,
    found: false,
    source: couchdbResult?.found ? 'COUCHDB' : null,
    entityType: couchdbResult?.entityType || null,
    entityId: couchdbResult?.entityId || null,
    hash,
    blockchainStatus: couchdbResult?.blockchainStatus || 'NOT_FOUND',
    createdDate: couchdbResult?.createdDate || null,
    relatedProof: couchdbResult?.relatedProof || null,
    details: couchdbResult?.details || {}
  };
}

async function searchPostgres(hash) {
  const sql = `
    WITH matches AS (
      SELECT
        'TRANSACTION_DOCUMENT'::text AS entity_type,
        td.id::text AS entity_id,
        td.document_hash::text AS hash,
        COALESCE(td.status, 'DOCUMENT_FOUND')::text AS blockchain_status,
        td.created_at AS created_date,
        jsonb_build_object(
          'proofId', CONCAT('PROOF-DOC-', td.id::text),
          'proofType', 'Document Verification Proof',
          'transactionId', td.transaction_id,
          'transactionReference', td.transaction_reference,
          'residentId', td.resident_id,
          'residentName', td.resident_name,
          'documentType', td.document_type,
          'sourceTable', 'transaction_documents'
        ) AS related_proof,
        jsonb_build_object(
          'table', 'blockchain.transaction_documents',
          'documentNumber', td.document_number,
          'originalFileName', td.original_file_name,
          'storedFileName', td.stored_file_name,
          'mimeType', td.mime_type,
          'fileSize', td.file_size,
          'currency', td.currency,
          'totalFees', td.total_fees
        ) AS details,
        'POSTGRESQL'::text AS source,
        1 AS priority
      FROM blockchain.transaction_documents td
      WHERE LOWER(td.document_hash::text) = LOWER($1)

      UNION ALL

      SELECT
        'GOVERNMENT_TRANSACTION_DOCUMENT_HASH'::text AS entity_type,
        gt.transaction_reference::text AS entity_id,
        gt.document_hash::text AS hash,
        COALESCE(gt.blockchain_status, gt.transaction_status, 'TRANSACTION_FOUND')::text AS blockchain_status,
        gt.created_at AS created_date,
        jsonb_build_object(
          'proofId', CONCAT('PROOF-TXN-', gt.transaction_id::text),
          'proofType', 'Transaction Approval Proof',
          'transactionId', gt.transaction_id,
          'transactionReference', gt.transaction_reference,
          'blockchainTxId', gt.blockchain_tx_id,
          'residentId', gt.resident_id,
          'serviceId', gt.service_id,
          'serviceName', gt.service_name,
          'sourceTable', 'government_transactions'
        ) AS related_proof,
        jsonb_build_object(
          'table', 'blockchain.government_transactions',
          'residentName', COALESCE(gt.resident_full_name, gt.resident_name),
          'residentWalletAddress', gt.resident_wallet_address,
          'amount', gt.amount,
          'totalFee', gt.total_fee,
          'currency', COALESCE(gt.currency, gt.currency_code),
          'paymentMethod', gt.payment_method,
          'transactionStatus', gt.transaction_status,
          'blockchainSubmittedAt', gt.blockchain_submitted_at
        ) AS details,
        'POSTGRESQL'::text AS source,
        2 AS priority
      FROM blockchain.government_transactions gt
      WHERE LOWER(gt.document_hash::text) = LOWER($1)

      UNION ALL

      SELECT
        'GOVERNMENT_TRANSACTION_BLOCKCHAIN_TX'::text AS entity_type,
        gt.transaction_reference::text AS entity_id,
        gt.blockchain_tx_id::text AS hash,
        COALESCE(gt.blockchain_status, gt.transaction_status, 'BLOCKCHAIN_TX_FOUND')::text AS blockchain_status,
        COALESCE(gt.blockchain_submitted_at, gt.created_at) AS created_date,
        jsonb_build_object(
          'proofId', CONCAT('PROOF-TXN-', gt.transaction_id::text),
          'proofType', 'Blockchain Transaction Proof',
          'transactionId', gt.transaction_id,
          'transactionReference', gt.transaction_reference,
          'documentHash', gt.document_hash,
          'residentId', gt.resident_id,
          'serviceId', gt.service_id,
          'serviceName', gt.service_name,
          'sourceTable', 'government_transactions'
        ) AS related_proof,
        jsonb_build_object(
          'table', 'blockchain.government_transactions',
          'residentName', COALESCE(gt.resident_full_name, gt.resident_name),
          'amount', gt.amount,
          'totalFee', gt.total_fee,
          'currency', COALESCE(gt.currency, gt.currency_code),
          'paymentMethod', gt.payment_method,
          'transactionStatus', gt.transaction_status,
          'blockchainError', gt.blockchain_error
        ) AS details,
        'POSTGRESQL'::text AS source,
        3 AS priority
      FROM blockchain.government_transactions gt
      WHERE LOWER(gt.blockchain_tx_id::text) = LOWER($1)

      UNION ALL

      SELECT
        'KYC_HASH'::text AS entity_type,
        kh.customer_id::text AS entity_id,
        kh.hash::text AS hash,
        'KYC_HASH_FOUND'::text AS blockchain_status,
        NULL::timestamp AS created_date,
        jsonb_build_object(
          'proofType', 'KYC Hash Proof',
          'customerId', kh.customer_id,
          'sourceTable', 'kyc_hashes'
        ) AS related_proof,
        jsonb_build_object(
          'table', 'blockchain.kyc_hashes',
          'customerId', kh.customer_id
        ) AS details,
        'POSTGRESQL'::text AS source,
        4 AS priority
      FROM blockchain.kyc_hashes kh
      WHERE LOWER(kh.hash::text) = LOWER($1)

      UNION ALL

      SELECT
        'FABRIC_TRANSACTION'::text AS entity_type,
        ft.id::text AS entity_id,
        ft.tx_id::text AS hash,
        COALESCE(ft.status, 'FABRIC_TX_FOUND')::text AS blockchain_status,
        ft.created_at AS created_date,
        jsonb_build_object(
          'proofType', 'Fabric Transaction Proof',
          'paymentId', ft.payment_id,
          'fabricTxId', ft.tx_id,
          'sourceTable', 'fabric_transactions'
        ) AS related_proof,
        jsonb_build_object(
          'table', 'blockchain.fabric_transactions',
          'paymentId', ft.payment_id,
          'fromAccount', ft.from_account,
          'toAccount', ft.to_account,
          'amount', ft.amount,
          'statusMessage', ft.status_message
        ) AS details,
        'POSTGRESQL'::text AS source,
        5 AS priority
      FROM blockchain.fabric_transactions ft
      WHERE LOWER(ft.tx_id::text) = LOWER($1)

      UNION ALL

      SELECT
        'GENERAL_TRANSACTION_AML_PROOF'::text AS entity_type,
        t.transaction_id::text AS entity_id,
        t.aml_proof_hash::text AS hash,
        COALESCE(t.fabric_status, t.transaction_status, t.status, 'AML_PROOF_FOUND')::text AS blockchain_status,
        t.created_at AS created_date,
        jsonb_build_object(
          'proofType', 'AML Proof Hash',
          'transactionId', t.transaction_id,
          'businessTransactionId', t.business_transaction_id,
          'fabricTxId', COALESCE(t.fabric_tx_id, t.fabric_transaction_id),
          'sourceTable', 'transactions'
        ) AS related_proof,
        jsonb_build_object(
          'table', 'blockchain.transactions',
          'amount', t.amount,
          'currency', COALESCE(t.currency, t.currency_code),
          'amlStatus', t.aml_status,
          'amlDecision', t.aml_decision,
          'amlRiskScore', t.aml_risk_score
        ) AS details,
        'POSTGRESQL'::text AS source,
        6 AS priority
      FROM blockchain.transactions t
      WHERE LOWER(t.aml_proof_hash::text) = LOWER($1)

      UNION ALL

      SELECT
        'GENERAL_TRANSACTION_FABRIC_TX'::text AS entity_type,
        t.transaction_id::text AS entity_id,
        COALESCE(t.fabric_tx_id, t.fabric_transaction_id)::text AS hash,
        COALESCE(t.fabric_status, t.transaction_status, t.status, 'FABRIC_TX_FOUND')::text AS blockchain_status,
        t.created_at AS created_date,
        jsonb_build_object(
          'proofType', 'General Fabric Transaction Proof',
          'transactionId', t.transaction_id,
          'businessTransactionId', t.business_transaction_id,
          'ledgerTransactionId', t.ledger_transaction_id,
          'sourceTable', 'transactions'
        ) AS related_proof,
        jsonb_build_object(
          'table', 'blockchain.transactions',
          'amount', t.amount,
          'currency', COALESCE(t.currency, t.currency_code),
          'transactionType', t.transaction_type,
          'transactionStatus', COALESCE(t.transaction_status, t.status),
          'fabricBlockNumber', t.fabric_block_number
        ) AS details,
        'POSTGRESQL'::text AS source,
        7 AS priority
      FROM blockchain.transactions t
      WHERE LOWER(COALESCE(t.fabric_tx_id, t.fabric_transaction_id)::text) = LOWER($1)
    )
    SELECT *
    FROM matches
    WHERE hash IS NOT NULL
    ORDER BY priority ASC, created_date DESC NULLS LAST
    LIMIT 1;
  `;

  const result = await pool.query(sql, [hash]);
  return result.rows[0] || null;
}

async function searchCouchDb(hash) {
  const enabled = String(process.env.HASH_VERIFY_COUCHDB_ENABLED || 'false').toLowerCase() === 'true';

  if (!enabled) {
    return {
      enabled: false,
      found: false,
      searched: false
    };
  }

  const couchUrl = process.env.COUCHDB_URL || 'http://admin:adminpw@localhost:5984';
  const databases = String(
    process.env.HASH_VERIFY_COUCHDB_DATABASES ||
      'kycchannelnix1_kyc-wallet-chaincode-js,kycchannelnix1_kyc-wallet-chaincode-js_private'
  )
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  for (const database of databases) {
    try {
      const response = await axios.post(
        `${couchUrl.replace(/\/$/, '')}/${encodeURIComponent(database)}/_find`,
        {
          selector: {
            $or: [
              { hash },
              { documentHash: hash },
              { document_hash: hash },
              { proofHash: hash },
              { proof_hash: hash },
              { blockchainTxId: hash },
              { blockchain_tx_id: hash },
              { txId: hash },
              { tx_id: hash }
            ]
          },
          limit: 1
        },
        {
          timeout: Number(process.env.HASH_VERIFY_COUCHDB_TIMEOUT_MS || 4000),
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const doc = response.data?.docs?.[0];

      if (doc) {
        return {
          enabled: true,
          searched: true,
          found: true,
          database,
          entityType: doc.entityType || doc.entity_type || doc.type || 'COUCHDB_DOCUMENT',
          entityId: doc.entityId || doc.entity_id || doc.id || doc._id,
          hash,
          blockchainStatus: doc.blockchainStatus || doc.blockchain_status || doc.status || 'FOUND_IN_COUCHDB',
          createdDate: doc.createdDate || doc.created_date || doc.createdAt || doc.created_at || null,
          relatedProof: doc.relatedProof || doc.related_proof || {
            proofType: 'CouchDB World State Match',
            couchDbId: doc._id,
            database
          },
          details: {
            database,
            couchDbId: doc._id,
            couchDbRev: doc._rev
          }
        };
      }
    } catch (error) {
      console.warn('[HASH_VERIFICATION_COUCHDB_WARNING]', {
        database,
        message: error.message
      });
    }
  }

  return {
    enabled: true,
    searched: true,
    found: false
  };
}

/**
 * POST /api/v1/government-blockchain/hash-verification
 */
router.post('/', async (req, res) => {
  const requestId = req.requestId || `REQ_${Date.now()}`;

  try {
    const hash = normalizeHash(req.body?.hash || req.body?.hashValue || req.body?.value);

    if (!isValidHashInput(hash)) {
      return res.status(400).json({
        success: false,
        message: 'Hash value is required and must be between 8 and 512 characters.',
        requestId,
        timestamp: new Date().toISOString()
      });
    }

    const postgresMatch = await searchPostgres(hash);

    if (postgresMatch) {
      return res.status(200).json({
        success: true,
        message: 'Hash verified successfully.',
        data: buildVerifiedResponse(postgresMatch),
        requestId,
        timestamp: new Date().toISOString()
      });
    }

    const couchdbResult = await searchCouchDb(hash);

    if (couchdbResult?.found) {
      return res.status(200).json({
        success: true,
        message: 'Hash verified successfully from CouchDB.',
        data: {
          verificationStatus: 'VERIFIED',
          verified: true,
          found: true,
          source: 'COUCHDB',
          entityType: couchdbResult.entityType,
          entityId: couchdbResult.entityId,
          hash,
          blockchainStatus: couchdbResult.blockchainStatus,
          createdDate: couchdbResult.createdDate,
          relatedProof: couchdbResult.relatedProof,
          details: couchdbResult.details
        },
        requestId,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(404).json({
      success: false,
      message: 'Hash not found.',
      data: buildNotFoundResponse(hash, couchdbResult),
      requestId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[HASH_VERIFICATION_ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to verify hash.',
      error: error.message,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
