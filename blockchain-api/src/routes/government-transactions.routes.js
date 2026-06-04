'use strict';

const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const util = require('util');

const execFileAsync = util.promisify(execFile);
const pool = require('../config/database');

function cleanValue(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return value;
}

function normalizeStatus(value) {
  if (!value) return 'PENDING';

  return String(value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function generateDocumentHash(documents = []) {
  if (!documents || documents.length === 0) {
    return null;
  }

  const verifiedDocument = documents.find((item) => item.hash && item.hash !== 'Pending generation');

  return verifiedDocument?.hash || null;
}

async function submitGovernmentTransactionToBlockchain(payload) {
  const invokeRequest = {
    function: 'CreateGovernmentTransaction',
    Args: [JSON.stringify(payload)]
  };

  const invokeRequestBase64 = Buffer
    .from(JSON.stringify(invokeRequest), 'utf8')
    .toString('base64');

  const script = `
set -e

ORG1_MSP=/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp
ORG1_TLS=/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crt
ORDERER_CA=/organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/msp/tlscacerts/tlsca.blockchain.local-cert.pem

export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_ADDRESS=peer0.org1.blockchain.local:7051
export CORE_PEER_MSPCONFIGPATH="$ORG1_MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="$ORG1_TLS"
export CORE_PEER_TLS_ENABLED=true

CALL_JSON=$(printf '%s' "$FABRIC_CC_CALL_B64" | base64 -d)

peer chaincode invoke \\
  -o orderer.blockchain.local:7050 \\
  --tls \\
  --cafile "$ORDERER_CA" \\
  -C kycchannelnix1 \\
  -n kyc-wallet-chaincode-js \\
  --peerAddresses peer0.org1.blockchain.local:7051 \\
  --tlsRootCertFiles "$ORG1_TLS" \\
  -c "$CALL_JSON"
`;

  try {
    const { stdout, stderr } = await execFileAsync(
      'docker',
      [
        'exec',
        '-e',
        `FABRIC_CC_CALL_B64=${invokeRequestBase64}`,
        'cli',
        'bash',
        '-lc',
        script
      ],
      {
        timeout: 120000,
        maxBuffer: 1024 * 1024 * 5
      }
    );

    const output = `${stdout || ''}\n${stderr || ''}`;

  let transactionId = null;

  /*
    Fabric CLI output sometimes escapes JSON like:
    \"blockchainTxId\":\"6396...\"
  */
  const txIdPatterns = [
    /blockchainTxId\\":\\"([a-f0-9]{64})/i,
    /\\"blockchainTxId\\":\\"([a-f0-9]{64})\\"/i,
    /"blockchainTxId":"([a-f0-9]{64})"/i,
    /"transactionId":"([a-f0-9]{64})"/i,
    /txid \[([a-f0-9]{64})\]/i
  ];

  for (const pattern of txIdPatterns) {
    const match = output.match(pattern);

    if (match && match[1]) {
      transactionId = match[1];
      break;
    }
  }

    return {
      success: true,
      type: 'docker-cli-submit',
      functionName: 'CreateGovernmentTransaction',
      transactionId,
      txId: transactionId,
      rawOutput: output
    };
  } catch (error) {
    const output = `${error.stdout || ''}\n${error.stderr || ''}`;

    throw new Error(
      output.trim() ||
      error.message ||
      'Government transaction blockchain submit failed'
    );
  }
}

/**
 * GET /api/v1/government-blockchain/transactions/residents-dropdown
 */
router.get('/residents-dropdown', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
          r.id AS value,
          CONCAT(
            COALESCE(r.resident_id, r.id::TEXT),
            ' — ',
            COALESCE(
              r.full_name,
              CONCAT_WS(' ', r.first_name, r.father_name, r.last_name)
            )
          ) AS label,
          r.id,
          r.resident_id,
          COALESCE(
            r.full_name,
            CONCAT_WS(' ', r.first_name, r.father_name, r.last_name)
          ) AS full_name,
          r.national_id_number,
          r.mobile_number,
          r.email,
          r.wallet_address,
          r.wallet_currency,
          r.wallet_status
      FROM blockchain.residents r
      ORDER BY r.id
    `);

    return res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('[RESIDENTS DROPDOWN ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load residents dropdown',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/government-blockchain/transactions/residents/search
 */
router.get('/residents/search', async (req, res) => {
  try {
    const {
      residentId,
      walletAddress,
      fullName,
      nationalId,
      mobile
    } = req.query;

    const result = await pool.query(
      `
      SELECT
          r.id,
          r.resident_id,
          COALESCE(r.full_name, CONCAT_WS(' ', r.first_name, r.father_name, r.last_name)) AS full_name,
          r.first_name,
          r.father_name,
          r.mother_name,
          r.last_name,
          r.arabic_full_name,
          r.national_id_number AS national_id,
          r.national_id_number,
          r.mobile_number,
          r.email,
          r.wallet_address,
          r.wallet_status,
          r.wallet_currency,
          r.record_status,
          r.blockchain_status,
          r.login_username,
          r.created_at,
          r.updated_at
      FROM blockchain.residents r
      WHERE 1 = 1
        AND ($1::TEXT IS NULL OR UPPER(r.resident_id::TEXT) LIKE UPPER('%' || $1 || '%'))
        AND ($2::TEXT IS NULL OR UPPER(r.wallet_address::TEXT) LIKE UPPER('%' || $2 || '%'))
        AND ($3::TEXT IS NULL OR UPPER(COALESCE(r.full_name, CONCAT_WS(' ', r.first_name, r.father_name, r.last_name))) LIKE UPPER('%' || $3 || '%'))
        AND ($4::TEXT IS NULL OR UPPER(r.national_id_number::TEXT) LIKE UPPER('%' || $4 || '%'))
        AND ($5::TEXT IS NULL OR UPPER(r.mobile_number::TEXT) LIKE UPPER('%' || $5 || '%'))
      ORDER BY r.created_at DESC
      LIMIT 50
      `,
      [
        residentId || null,
        walletAddress || null,
        fullName || null,
        nationalId || null,
        mobile || null
      ]
    );

    return res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('[RESIDENT SEARCH ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to search residents',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/government-blockchain/transactions/services
 */
router.get('/services', async (req, res) => {
  try {
    const {
      ministryId,
      administrationId,
      categoryId,
      serviceStatus,
      search
    } = req.query;

    const result = await pool.query(
      `
      SELECT
          gs.service_id,
          gs.service_public_id,
          gs.service_code,
          gs.service_name,
          gs.arabic_name,
          gs.ministry_id,
          gs.administration_id,
          gs.category_id,
          gs.fee_amount,
          gs.currency_code,
          gs.required_documents,
          gs.digital_stamp_required,
          gs.processing_time,
          gs.service_status,
          gs.description,
          gs.created_at,
          gs.updated_at,
          gs.fee_amount AS service_fee,
          gs.currency_code AS currency,
          gs.description AS service_description
      FROM blockchain.government_services gs
      WHERE 1 = 1
        AND ($1::TEXT IS NULL OR gs.ministry_id::TEXT = $1::TEXT)
        AND ($2::TEXT IS NULL OR gs.administration_id::TEXT = $2::TEXT)
        AND ($3::TEXT IS NULL OR gs.category_id::TEXT = $3::TEXT)
        AND ($4::TEXT IS NULL OR UPPER(gs.service_status::TEXT) = UPPER($4))
        AND (
              $5::TEXT IS NULL
              OR UPPER(gs.service_code::TEXT) LIKE UPPER('%' || $5 || '%')
              OR UPPER(gs.service_name::TEXT) LIKE UPPER('%' || $5 || '%')
              OR UPPER(gs.arabic_name::TEXT) LIKE UPPER('%' || $5 || '%')
              OR UPPER(gs.description::TEXT) LIKE UPPER('%' || $5 || '%')
            )
      ORDER BY gs.created_at DESC, gs.service_name ASC
      `,
      [
        ministryId || null,
        administrationId || null,
        categoryId || null,
        serviceStatus || null,
        search || null
      ]
    );

    return res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('[SERVICES LIST ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load government services',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/government-blockchain/transactions
 */
router.post('/', async (req, res) => {
  let transactionReference = null;
  let savedTransaction = null;

  try {
    const {
      resident,
      service,
      transaction,
      createdBy,
      documents
    } = req.body;

    if (!resident) {
      return res.status(400).json({
        success: false,
        message: 'resident object is required'
      });
    }

    if (!service) {
      return res.status(400).json({
        success: false,
        message: 'service object is required'
      });
    }

    if (!transaction) {
      return res.status(400).json({
        success: false,
        message: 'transaction object is required'
      });
    }

    const refResult = await pool.query(`
      SELECT
        'GOV-TXN-' || LPAD(nextval('blockchain.government_transaction_ref_seq')::TEXT, 6, '0') AS transaction_reference
    `);

    transactionReference = refResult.rows[0].transaction_reference;

    const documentHash = cleanValue(transaction.documentHash || transaction.document_hash) ||
      generateDocumentHash(documents || []);

    const insertResult = await pool.query(
      `
      INSERT INTO blockchain.government_transactions (
          transaction_reference,

          resident_id,
          resident_wallet_address,
          resident_full_name,
          resident_national_id,
          resident_mobile,
          resident_email,

          service_id,
          service_public_id,
          service_code,
          service_name,
          service_arabic_name,
          ministry_id,
          administration_id,
          category_id,

          amount,
          currency_code,
          payment_method,

          transaction_type,
          transaction_status,
          notes,
          document_hash,

          created_by_account_type,
          created_by_login_username,
          created_by_wallet_address,

          blockchain_status
      )
      VALUES (
          $1,
          $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18,
          $19, $20, $21, $22,
          $23, $24, $25,
          'PENDING'
      )
      RETURNING *
      `,
      [
        transactionReference,

        cleanValue(resident.residentId || resident.resident_id),
        cleanValue(resident.walletAddress || resident.wallet_address),
        cleanValue(resident.fullName || resident.full_name),
        cleanValue(resident.nationalId || resident.national_id || resident.national_id_number),
        cleanValue(resident.mobile || resident.mobile_number),
        cleanValue(resident.email),

        Number(service.serviceId || service.service_id || 0),
        cleanValue(service.servicePublicId || service.service_public_id),
        cleanValue(service.serviceCode || service.service_code),
        cleanValue(service.serviceName || service.service_name),
        cleanValue(service.arabicName || service.arabic_name),

        cleanValue(service.ministryId || service.ministry_id),
        cleanValue(service.administrationId || service.administration_id),
        cleanValue(service.categoryId || service.category_id),

        Number(transaction.amount || transaction.feeAmount || service.fee_amount || 0),
        cleanValue(transaction.currencyCode || transaction.currency_code || transaction.currency || service.currency_code || 'LBP'),
        cleanValue(transaction.paymentMethod || transaction.payment_method || 'WALLET'),

        cleanValue(transaction.transactionType || transaction.transaction_type || 'GOVERNMENT_SERVICE'),
        normalizeStatus(transaction.transactionStatus || transaction.transaction_status || 'SUBMITTED'),
        cleanValue(transaction.notes),
        cleanValue(documentHash),

        cleanValue(createdBy?.accountType || createdBy?.account_type || 'PUBLIC_ADMINISTRATION'),
        cleanValue(createdBy?.loginUsername || createdBy?.login_username || 'system'),
        cleanValue(createdBy?.walletAddress || createdBy?.wallet_address)
      ]
    );

    savedTransaction = insertResult.rows[0];
  } catch (error) {
    console.error('[CREATE GOVERNMENT TRANSACTION POSTGRES ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create government transaction in PostgreSQL',
      error: error.message
    });
  }

  let blockchainResult = null;
  let blockchainStatus = 'FAILED';
  let blockchainTxId = null;

  try {
    const blockchainPayload = {
      docType: 'GOVERNMENT_TRANSACTION',
      transactionReference: savedTransaction.transaction_reference,

      residentId: savedTransaction.resident_id,
      residentWalletAddress: savedTransaction.resident_wallet_address,
      residentFullName: savedTransaction.resident_full_name,
      residentNationalId: savedTransaction.resident_national_id,
      residentMobile: savedTransaction.resident_mobile,
      residentEmail: savedTransaction.resident_email,

      serviceId: savedTransaction.service_id ? String(savedTransaction.service_id) : null,
      servicePublicId: savedTransaction.service_public_id,
      serviceCode: savedTransaction.service_code,
      serviceName: savedTransaction.service_name,
      serviceArabicName: savedTransaction.service_arabic_name,
      ministryId: savedTransaction.ministry_id,
      administrationId: savedTransaction.administration_id,
      categoryId: savedTransaction.category_id,

      amount: savedTransaction.amount ? String(savedTransaction.amount) : '0',
      currencyCode: savedTransaction.currency_code,
      paymentMethod: savedTransaction.payment_method,
      transactionType: savedTransaction.transaction_type,
      transactionStatus: savedTransaction.transaction_status,

      notes: savedTransaction.notes,
      documentHash: savedTransaction.document_hash,

      createdByAccountType: savedTransaction.created_by_account_type,
      createdByLoginUsername: savedTransaction.created_by_login_username,
      createdByWalletAddress: savedTransaction.created_by_wallet_address,

      createdAt: savedTransaction.created_at
    };

    blockchainResult = await submitGovernmentTransactionToBlockchain(blockchainPayload);

    blockchainTxId =
      blockchainResult?.transactionId ||
      blockchainResult?.txId ||
      null;

  const finalUpdateResult = await pool.query(
    `
    UPDATE blockchain.government_transactions
    SET
        blockchain_status = 'SYNCED',
        blockchain_tx_id = $1,
        blockchain_error = NULL,
        blockchain_submitted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE transaction_reference = $2
    RETURNING *
    `,
    [
      blockchainTxId,
      transactionReference
    ]
  );

savedTransaction = finalUpdateResult.rows[0] || savedTransaction;

    blockchainStatus = 'SYNCED';
  } catch (blockchainError) {
    console.error('[CREATE GOVERNMENT TRANSACTION BLOCKCHAIN ERROR]', blockchainError);

    await pool.query(
      `
      UPDATE blockchain.government_transactions
      SET
          blockchain_status = 'FAILED',
          blockchain_error = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE transaction_reference = $2
      `,
      [
        blockchainError.message,
        transactionReference
      ]
    );

    blockchainStatus = 'FAILED';
  }

  return res.status(201).json({
    success: true,
    message: 'Government transaction created successfully',
    transactionReference,
    postgresqlStatus: 'SAVED',
    blockchainStatus,
    blockchainTxId,
    data: savedTransaction,
    blockchainResult
  });
});

/**
 * GET /api/v1/government-blockchain/transactions
 */
router.get('/', async (req, res) => {
  try {
    const {
      transactionReference,
      residentId,
      walletAddress,
      serviceCode,
      transactionStatus,
      blockchainStatus,
      fromDate,
      toDate
    } = req.query;

    const result = await pool.query(
      `
      SELECT
          transaction_id,
          transaction_reference,
          resident_id,
          resident_wallet_address,
          resident_full_name,
          resident_national_id,
          resident_mobile,
          resident_email,
          service_id,
          service_public_id,
          service_code,
          service_name,
          service_arabic_name,
          ministry_id,
          administration_id,
          category_id,
          amount,
          currency_code,
          payment_method,
          transaction_type,
          transaction_status,
          notes,
          document_hash,
          created_by_account_type,
          created_by_login_username,
          created_by_wallet_address,
          blockchain_tx_id,
          blockchain_status,
          blockchain_error,
          blockchain_submitted_at,
          created_at,
          updated_at
      FROM blockchain.government_transactions
      WHERE 1 = 1
        AND ($1::TEXT IS NULL OR UPPER(transaction_reference) LIKE UPPER('%' || $1 || '%'))
        AND ($2::TEXT IS NULL OR UPPER(resident_id::TEXT) LIKE UPPER('%' || $2 || '%'))
        AND ($3::TEXT IS NULL OR UPPER(resident_wallet_address::TEXT) LIKE UPPER('%' || $3 || '%'))
        AND ($4::TEXT IS NULL OR UPPER(service_code::TEXT) LIKE UPPER('%' || $4 || '%'))
        AND ($5::TEXT IS NULL OR UPPER(transaction_status::TEXT) = UPPER($5))
        AND ($6::TEXT IS NULL OR UPPER(blockchain_status::TEXT) = UPPER($6))
        AND ($7::DATE IS NULL OR created_at::DATE >= $7)
        AND ($8::DATE IS NULL OR created_at::DATE <= $8)
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [
        cleanValue(transactionReference),
        cleanValue(residentId),
        cleanValue(walletAddress),
        cleanValue(serviceCode),
        cleanValue(transactionStatus),
        cleanValue(blockchainStatus),
        cleanValue(fromDate),
        cleanValue(toDate)
      ]
    );

    return res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('[TRANSACTIONS LIST ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load government transactions',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/government-blockchain/transactions/:transactionReference
 */
router.get('/:transactionReference', async (req, res) => {
  try {
    const { transactionReference } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM blockchain.government_transactions
      WHERE UPPER(transaction_reference) = UPPER($1)
      LIMIT 1
      `,
      [transactionReference]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[TRANSACTION DETAILS ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load transaction details',
      error: error.message
    });
  }
});

module.exports = router;