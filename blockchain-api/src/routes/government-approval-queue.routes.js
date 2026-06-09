'use strict';

const express = require('express');
const crypto = require('crypto');

const router = express.Router();

let dbModule;

try {
  dbModule = require('../config/database');
} catch (error) {
  dbModule = require('../config/db');
}

const fabricService = require('../services/fabric.service');

function getPool() {
  return dbModule.pool || dbModule;
}

async function getClient() {
  if (typeof dbModule.getClient === 'function') {
    return dbModule.getClient();
  }

  const pool = getPool();

  if (typeof pool.connect === 'function') {
    return pool.connect();
  }

  throw new Error('PostgreSQL pool connect function is not available.');
}

function cleanText(value) {
  return String(value || '').trim();
}

function normalizePendingStatus(value) {
  const status = cleanText(value).toUpperCase().replace(/\s+/g, '_');
  return status === 'PENDING_REVIEW' || status === 'PENDING_APPROVAL';
}

function buildProofPayload(transactionRow, approvedBy) {
  return {
    proofType: 'GOVERNMENT_TRANSACTION_APPROVAL',
    transactionId: String(transactionRow.transaction_id),
    transactionReference: transactionRow.transaction_reference,
    residentId: transactionRow.resident_id,
    residentName:
      transactionRow.resident_full_name ||
      transactionRow.resident_name ||
      null,
    residentWalletAddress: transactionRow.resident_wallet_address || null,
    serviceId: transactionRow.service_id,
    serviceCode: transactionRow.service_code || null,
    serviceName: transactionRow.service_name || null,
    ministryId: transactionRow.ministry_id || null,
    ministryName: transactionRow.ministry_name || null,
    administrationId: transactionRow.administration_id || null,
    amount: Number(transactionRow.total_fee || transactionRow.amount || 0),
    currency: 'GOV',
    paymentMethod: transactionRow.payment_method || null,
    transactionType:
      transactionRow.transaction_type || 'GOVERNMENT_SERVICE',
    transactionStatus: 'APPROVED',
    documentHash: transactionRow.document_hash || null,
    approvedBy: approvedBy || 'approval-officer',
    approvedAt: new Date().toISOString(),
    sourceSystem: 'GOVERNMENT_BLOCKCHAIN_APPROVAL_QUEUE'
  };
}

function hashProofPayload(payload) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function extractBlockchainTxId(fabricResult) {
  return (
    fabricResult?.transactionId ||
    fabricResult?.txId ||
    fabricResult?.data?.transactionId ||
    fabricResult?.data?.txId ||
    null
  );
}

async function submitApprovalProofToBlockchain(transactionRow, approvedBy, req) {
  const proofPayload = buildProofPayload(transactionRow, approvedBy);
  const proofHash = hashProofPayload(proofPayload);

  const functionName =
    process.env.GOV_APPROVAL_CHAINCODE_FUNCTION ||
    process.env.GOV_TRANSACTION_PROOF_FUNCTION ||
    'CreateGovernmentTransactionProof';

  const fabricResult = await fabricService.submitTransaction(
    functionName,
    [
      transactionRow.transaction_reference,
      JSON.stringify({
        ...proofPayload,
        proofHash
      })
    ],
    {
      requestId: req.requestId || req.headers['x-request-id'] || null,
      correlationId:
        req.correlationId || req.headers['x-correlation-id'] || null,
      sourceSystem: 'BLOCKCHAIN_API',
      requestSource: 'APPROVAL_QUEUE',
      createdBy: approvedBy || 'approval-officer'
    }
  );

  return {
    functionName,
    proofHash,
    fabricResult,
    blockchainTxId: extractBlockchainTxId(fabricResult)
  };
}

/**
 * GET /api/v1/government-blockchain/approval-queue
 *
 * Loads all government transactions waiting for manual approval.
 */
router.get('/', async (req, res) => {
  try {
    const result = await getPool().query(`
      SELECT
        gt.transaction_id,
        gt.transaction_reference,

        gt.resident_id,
        gt.resident_db_id,
        gt.resident_wallet_address,
        COALESCE(gt.resident_full_name, gt.resident_name, '-') AS resident_name,
        COALESCE(gt.resident_full_name, gt.resident_name, '-') AS resident_full_name,
        gt.resident_national_id,
        gt.resident_mobile,
        gt.resident_email,

        gt.service_id,
        gt.service_public_id,
        gt.service_code,
        COALESCE(gt.service_name, '-') AS service_name,
        gt.service_arabic_name,
        gt.service_category,

        gt.ministry_id,
        gt.ministry_name,
        gt.administration_id,
        COALESCE(pa.administration_name, '-') AS administration_name,
        gt.category_id,

        COALESCE(gt.total_fee, gt.amount, 0)::NUMERIC AS total_fees,
        COALESCE(gt.total_fee, gt.amount, 0)::NUMERIC AS total_fee,
        COALESCE(gt.amount, gt.total_fee, 0)::NUMERIC AS amount,
        'GOV' AS currency,
        'GOV' AS currency_code,

        gt.payment_method,
        gt.payment_details,
        gt.transaction_type,
        gt.transaction_status,
        gt.notes,
        gt.document_hash,
        gt.uploaded_documents_count,
        gt.digital_stamp_required,

        gt.blockchain_tx_id,
        gt.blockchain_status,
        gt.blockchain_error,
        gt.blockchain_submitted_at,

        gt.created_at,
        gt.updated_at
      FROM blockchain.government_transactions gt
      LEFT JOIN blockchain.public_administrations pa
        ON pa.administration_id::TEXT = gt.administration_id::TEXT
      WHERE UPPER(REPLACE(COALESCE(gt.transaction_status, ''), ' ', '_')) = 'PENDING_REVIEW'
      ORDER BY gt.created_at DESC NULLS LAST, gt.transaction_id DESC
    `);

    return res.status(200).json({
      success: true,
      message: 'Approval queue loaded successfully from PostgreSQL.',
      data: result.rows,
      total: result.rowCount
    });
  } catch (error) {
    console.error('[APPROVAL QUEUE LOAD ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to load approval queue.',
      error: error.message,
      code: error.code || null,
      detail: error.detail || null,
      hint: error.hint || null
    });
  }
});

/**
 * GET /api/v1/government-blockchain/approval-queue/:transactionId
 *
 * Loads one approval queue transaction for View Details.
 */
router.get('/:transactionId', async (req, res) => {
  try {
    const transactionId = cleanText(req.params.transactionId);

    const result = await getPool().query(
      `
      SELECT *
      FROM blockchain.government_transactions
      WHERE transaction_id::TEXT = $1
         OR transaction_reference = $1
      LIMIT 1
      `,
      [transactionId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Transaction details loaded successfully.',
      data: result.rows[0]
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load transaction details.',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/government-blockchain/approval-queue/:transactionId/approve
 *
 * Approves the transaction, submits approval proof to Fabric, then saves blockchain result.
 */
router.post('/:transactionId/approve', async (req, res) => {
  const client = await getClient();
  const transactionId = cleanText(req.params.transactionId);
  const approvedBy =
    cleanText(req.body?.approvedBy) ||
    cleanText(req.body?.officerUsername) ||
    cleanText(req.body?.createdBy) ||
    'approval-officer';

  let lockedTransaction = null;

  try {
    await client.query('BEGIN');

    const lockResult = await client.query(
      `
      SELECT *
      FROM blockchain.government_transactions
      WHERE transaction_id::TEXT = $1
         OR transaction_reference = $1
      FOR UPDATE
      `,
      [transactionId]
    );

    if (lockResult.rowCount === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Transaction not found.'
      });
    }

    lockedTransaction = lockResult.rows[0];

    if (!normalizePendingStatus(lockedTransaction.transaction_status)) {
      await client.query('ROLLBACK');

      return res.status(409).json({
        success: false,
        message: 'Only Pending Review transactions can be approved.',
        data: {
          transactionId: lockedTransaction.transaction_id,
          transactionReference: lockedTransaction.transaction_reference,
          currentStatus: lockedTransaction.transaction_status,
          blockchainStatus: lockedTransaction.blockchain_status
        }
      });
    }

    const approvedResult = await client.query(
      `
      UPDATE blockchain.government_transactions
      SET
        transaction_status = 'APPROVED',
        blockchain_status = 'Submitting to Blockchain',
        blockchain_error = NULL,
        updated_at = NOW()
      WHERE transaction_id = $1
      RETURNING *
      `,
      [lockedTransaction.transaction_id]
    );

    await client.query('COMMIT');

    lockedTransaction = approvedResult.rows[0];
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[APPROVAL QUEUE APPROVE ROLLBACK ERROR]', rollbackError);
    }

    console.error('[APPROVAL QUEUE APPROVE DB ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });

    client.release();

    return res.status(500).json({
      success: false,
      message: 'Failed to approve transaction in PostgreSQL.',
      error: error.message,
      code: error.code || null,
      detail: error.detail || null,
      hint: error.hint || null
    });
  } finally {
    if (!lockedTransaction && client && typeof client.release === 'function') {
      client.release();
    }
  }

  try {
    const blockchainResult = await submitApprovalProofToBlockchain(
      lockedTransaction,
      approvedBy,
      req
    );

    const updateResult = await getPool().query(
      `
      UPDATE blockchain.government_transactions
      SET
        blockchain_tx_id = $2,
        blockchain_status = 'Blockchain Confirmed',
        blockchain_error = NULL,
        blockchain_submitted_at = NOW(),
        document_hash = COALESCE(document_hash, $3),
        updated_at = NOW()
      WHERE transaction_id = $1
      RETURNING *
      `,
      [
        lockedTransaction.transaction_id,
        blockchainResult.blockchainTxId || blockchainResult.proofHash,
        blockchainResult.proofHash
      ]
    );

    if (client && typeof client.release === 'function') {
      client.release();
    }

    return res.status(200).json({
      success: true,
      message: 'Transaction approved and submitted to Blockchain successfully.',
      data: updateResult.rows[0],
      blockchain: {
        status: 'Blockchain Confirmed',
        txId: blockchainResult.blockchainTxId,
        proofHash: blockchainResult.proofHash,
        functionName: blockchainResult.functionName,
        result: blockchainResult.fabricResult
      }
    });
  } catch (blockchainError) {
    const failedResult = await getPool().query(
      `
      UPDATE blockchain.government_transactions
      SET
        blockchain_status = 'Blockchain Failed',
        blockchain_error = $2,
        blockchain_submitted_at = NOW(),
        updated_at = NOW()
      WHERE transaction_id = $1
      RETURNING *
      `,
      [
        lockedTransaction.transaction_id,
        blockchainError.message
      ]
    );

    if (client && typeof client.release === 'function') {
      client.release();
    }

    console.error('[APPROVAL QUEUE BLOCKCHAIN SUBMIT ERROR]', {
      transactionId: lockedTransaction.transaction_id,
      transactionReference: lockedTransaction.transaction_reference,
      message: blockchainError.message
    });

    return res.status(200).json({
      success: true,
      warning: true,
      message:
        'Transaction approved in PostgreSQL, but Blockchain submission failed.',
      data: failedResult.rows[0],
      blockchain: {
        status: 'Blockchain Failed',
        error: blockchainError.message
      }
    });
  }
});

/**
 * POST /api/v1/government-blockchain/approval-queue/:transactionId/reject
 *
 * Optional rejection action.
 */
router.post('/:transactionId/reject', async (req, res) => {
  try {
    const transactionId = cleanText(req.params.transactionId);
    const reason = cleanText(req.body?.reason) || 'Rejected by approval officer';

    const result = await getPool().query(
      `
      UPDATE blockchain.government_transactions
      SET
        transaction_status = 'REJECTED',
        blockchain_status = 'Not Submitted',
        blockchain_error = $2,
        notes = COALESCE(notes, '') || E'\nRejection Reason: ' || $2,
        updated_at = NOW()
      WHERE (transaction_id::TEXT = $1 OR transaction_reference = $1)
        AND UPPER(REPLACE(COALESCE(transaction_status, ''), ' ', '_')) = 'PENDING_REVIEW'
      RETURNING *
      `,
      [transactionId, reason]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message:
          'Pending Review transaction not found, or transaction is not pending review.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Transaction rejected successfully.',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[APPROVAL QUEUE REJECT ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to reject transaction.',
      error: error.message
    });
  }
});

module.exports = router;
