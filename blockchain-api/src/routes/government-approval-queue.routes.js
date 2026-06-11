const express = require('express');
const router = express.Router();

const db = require('../config/database');
const pool = db.pool || db;

function sendSuccess(res, data, message = 'Success') {
  return res.json({
    success: true,
    message,
    data,
    meta: null,
    timestamp: new Date().toISOString()
  });
}

function sendError(res, status, message, errorCode = 'ERROR') {
  return res.status(status).json({
    success: false,
    message,
    errorCode,
    data: null,
    meta: null,
    timestamp: new Date().toISOString()
  });
}

function normalizeStatus(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
}

router.get('/summary', async (req, res) => {
  try {
    const sql = `
      SELECT
        COUNT(*) FILTER (
          WHERE UPPER(REPLACE(COALESCE(transaction_status, ''), ' ', '_')) IN
          ('PENDING_REVIEW', 'PENDING_APPROVAL', 'PENDING')
        )::int AS pending_queue,

        COUNT(*) FILTER (
          WHERE UPPER(REPLACE(COALESCE(transaction_status, ''), ' ', '_')) = 'PENDING_REVIEW'
        )::int AS pending_review,

        COUNT(*) FILTER (
          WHERE UPPER(REPLACE(COALESCE(transaction_status, ''), ' ', '_')) IN
          ('APPROVING', 'PROCESSING', 'BLOCKCHAIN_SUBMITTING')
        )::int AS approving_now,

        COUNT(*) FILTER (
          WHERE UPPER(REPLACE(COALESCE(blockchain_status, ''), ' ', '_')) IN
          ('FAILED', 'ERROR', 'BLOCKCHAIN_FAILED')
        )::int AS blockchain_failed
      FROM blockchain.government_transactions;
    `;

    const result = await pool.query(sql);
    const row = result.rows[0] || {};

    return sendSuccess(res, {
      pendingQueue: Number(row.pending_queue || 0),
      pendingReview: Number(row.pending_review || 0),
      approvingNow: Number(row.approving_now || 0),
      blockchainFailed: Number(row.blockchain_failed || 0)
    }, 'Approval queue summary loaded successfully.');
  } catch (error) {
    console.error('[APPROVAL QUEUE SUMMARY ERROR]', error);
    return sendError(res, 500, error.message, 'APPROVAL_QUEUE_SUMMARY_ERROR');
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const {
      status = 'PENDING_REVIEW',
      search = '',
      paymentMethod = ''
    } = req.query;

    const params = [];
    let where = `WHERE 1=1`;

    if (status && status !== 'ALL') {
      params.push(normalizeStatus(status));
      where += `
        AND UPPER(REPLACE(COALESCE(t.transaction_status, ''), ' ', '_')) = $${params.length}
      `;
    }

    if (search) {
      params.push(`%${String(search).toLowerCase()}%`);
      where += `
        AND (
          LOWER(COALESCE(t.transaction_id::text, '')) LIKE $${params.length}
          OR LOWER(COALESCE(t.resident_full_name, '')) LIKE $${params.length}
          OR LOWER(COALESCE(t.service_name, '')) LIKE $${params.length}
          OR LOWER(COALESCE(t.payment_method, '')) LIKE $${params.length}
        )
      `;
    }

    if (paymentMethod && paymentMethod !== 'ALL') {
      params.push(String(paymentMethod).toLowerCase());
      where += `
        AND LOWER(COALESCE(t.payment_method, 'RESIDENT WALLET')) = $${params.length}
      `;
    }

    const sql = `
      SELECT
        t.transaction_id,
        t.transaction_id::text AS transaction_reference,
        COALESCE(t.resident_full_name, 'Unknown Resident') AS resident_name,
        COALESCE(t.service_name, 'Unknown Service') AS service_name,
        COALESCE(t.total_fee,   0) AS total_fees,
        COALESCE(t.currency_code, 'GOV') AS currency,
        COALESCE(t.payment_method, 'RESIDENT WALLET') AS payment_method,
        t.created_at AS submitted_date,
        COALESCE(t.transaction_status, 'PENDING_REVIEW') AS status,
        COALESCE(t.blockchain_status, 'PENDING') AS blockchain_status
      FROM blockchain.government_transactions t
      ${where}
      ORDER BY t.created_at DESC NULLS LAST, t.transaction_id DESC;
    `;

    const result = await pool.query(sql, params);

    return sendSuccess(res, result.rows, 'Approval queue transactions loaded successfully.');
  } catch (error) {
    console.error('[APPROVAL QUEUE TRANSACTIONS ERROR]', error);
    return sendError(res, 500, error.message, 'APPROVAL_QUEUE_TRANSACTIONS_ERROR');
  }
});

router.patch('/transactions/approve-selected', async (req, res) => {
  try {
    const {
      transactionIds = [],
      approvedBy = 'OFFICER_ADMIN',
      notes = null
    } = req.body || {};

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return sendError(res, 400, 'transactionIds array is required.', 'VALIDATION_ERROR');
    }

    const sql = `
      UPDATE blockchain.government_transactions
      SET
        transaction_status = 'APPROVED',
        blockchain_status = COALESCE(blockchain_status, 'PENDING'),
        updated_at = NOW()
      WHERE transaction_id::text = ANY($1::text[])
        AND UPPER(REPLACE(COALESCE(transaction_status, ''), ' ', '_')) = 'PENDING_REVIEW'
      RETURNING *;
    `;

    const result = await pool.query(sql, [transactionIds.map(String)]);

    return sendSuccess(res, {
      approvedBy,
      notes,
      approvedCount: result.rowCount,
      approvedTransactions: result.rows
    }, 'Selected transactions approved successfully.');
  } catch (error) {
    console.error('[APPROVAL QUEUE APPROVE SELECTED ERROR]', error);
    return sendError(res, 500, error.message, 'APPROVAL_QUEUE_APPROVE_SELECTED_ERROR');
  }
});

router.get('/transactions/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;

    const sql = `
      SELECT
        t.*,
        t.transaction_id::text AS transaction_reference,
        COALESCE(t.resident_full_name, 'Unknown Resident') AS resident_name,
        COALESCE(t.service_name, 'Unknown Service') AS service_name,
        COALESCE(t.ministry_name, 'Unknown Ministry') AS ministry_name
      FROM blockchain.government_transactions t
      WHERE t.transaction_id::text = $1
      LIMIT 1;
    `;

    const result = await pool.query(sql, [transactionId]);

    if (!result.rows.length) {
      return sendError(res, 404, 'Transaction not found.', 'TRANSACTION_NOT_FOUND');
    }

    return sendSuccess(res, result.rows[0], 'Transaction details loaded successfully.');
  } catch (error) {
    console.error('[APPROVAL QUEUE DETAILS ERROR]', error);
    return sendError(res, 500, error.message, 'APPROVAL_QUEUE_DETAILS_ERROR');
  }
});

router.patch('/transactions/:transactionId/approve', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { approvedBy = 'OFFICER_ADMIN', notes = null } = req.body || {};

    const sql = `
      UPDATE blockchain.government_transactions
      SET
        transaction_status = 'APPROVED',
        blockchain_status = COALESCE(blockchain_status, 'PENDING'),
        updated_at = NOW()
      WHERE transaction_id::text = $1
        AND UPPER(REPLACE(COALESCE(transaction_status, ''), ' ', '_')) = 'PENDING_REVIEW'
      RETURNING *;
    `;

    const result = await pool.query(sql, [transactionId]);

    if (!result.rows.length) {
      return sendError(res, 404, 'Transaction not found or not pending review.', 'TRANSACTION_NOT_PENDING');
    }

    return sendSuccess(res, {
      approvedBy,
      notes,
      transaction: result.rows[0]
    }, 'Transaction approved successfully.');
  } catch (error) {
    console.error('[APPROVAL QUEUE APPROVE ERROR]', error);
    return sendError(res, 500, error.message, 'APPROVAL_QUEUE_APPROVE_ERROR');
  }
});

router.patch('/transactions/:transactionId/reject', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const {
      rejectedBy = 'OFFICER_ADMIN',
      reason = 'Rejected from approval queue screen'
    } = req.body || {};

    const sql = `
      UPDATE blockchain.government_transactions
      SET
        transaction_status = 'REJECTED',
        updated_at = NOW()
      WHERE transaction_id::text = $1
        AND UPPER(REPLACE(COALESCE(transaction_status, ''), ' ', '_')) = 'PENDING_REVIEW'
      RETURNING *;
    `;

    const result = await pool.query(sql, [transactionId]);

    if (!result.rows.length) {
      return sendError(res, 404, 'Transaction not found or not pending review.', 'TRANSACTION_NOT_PENDING');
    }

    return sendSuccess(res, {
      rejectedBy,
      reason,
      transaction: result.rows[0]
    }, 'Transaction rejected successfully.');
  } catch (error) {
    console.error('[APPROVAL QUEUE REJECT ERROR]', error);
    return sendError(res, 500, error.message, 'APPROVAL_QUEUE_REJECT_ERROR');
  }
});

module.exports = router;
