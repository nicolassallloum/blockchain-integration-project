const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * GET /api/v1/government-blockchain/transactions
 * Source table:
 * blockchain.government_transactions
 */
router.get('/', async (req, res) => {
  try {
    const {
      search,
      status,
      blockchainStatus,
      limit = 50,
      offset = 0
    } = req.query;

    const conditions = [];
    const values = [];
    let index = 1;

    if (search && search.trim() !== '') {
      conditions.push(`
        (
          gt.transaction_reference ILIKE $${index}
          OR gt.resident_full_name ILIKE $${index}
          OR gt.resident_name ILIKE $${index}
          OR gt.resident_wallet_address ILIKE $${index}
          OR gt.resident_national_id ILIKE $${index}
          OR gt.service_code ILIKE $${index}
          OR gt.service_name ILIKE $${index}
          OR gt.service_arabic_name ILIKE $${index}
          OR gt.blockchain_tx_id ILIKE $${index}
        )
      `);

      values.push(`%${search.trim()}%`);
      index++;
    }

    if (status && status !== 'ALL') {
      conditions.push(`UPPER(COALESCE(gt.transaction_status, '')) = UPPER($${index})`);
      values.push(status);
      index++;
    }

    if (blockchainStatus && blockchainStatus !== 'ALL') {
      conditions.push(`UPPER(COALESCE(gt.blockchain_status, '')) = UPPER($${index})`);
      values.push(blockchainStatus);
      index++;
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const dataQuery = `
      SELECT
        gt.transaction_id,
        gt.transaction_reference,

        gt.resident_id,
        gt.resident_db_id,
        gt.resident_wallet_address,
        gt.resident_full_name,
        gt.resident_name,
        gt.resident_national_id,
        gt.resident_mobile,
        gt.resident_email,

        gt.service_id,
        gt.service_public_id,
        gt.service_code,
        gt.service_name,
        gt.service_arabic_name,
        gt.service_category,
        gt.category_id,

        gt.ministry_id,
        gt.ministry_name,
        gt.administration_id,

        gt.amount,
        gt.total_fee,
        COALESCE(gt.currency_code, gt.currency, 'LBP') AS currency_code,
        gt.currency,

        gt.payment_method,
        gt.transaction_type,
        gt.transaction_status,

        gt.notes,
        gt.document_hash,
        gt.digital_stamp_required,
        gt.uploaded_documents_count,

        gt.created_by_account_type,
        gt.created_by_login_username,
        gt.created_by_wallet_address,

        gt.blockchain_tx_id,
        gt.blockchain_status,
        gt.blockchain_error,
        gt.blockchain_submitted_at,

        gt.created_at,
        gt.updated_at
      FROM blockchain.government_transactions gt
      ${whereClause}
      ORDER BY gt.created_at DESC NULLS LAST, gt.transaction_id DESC
      LIMIT $${index}
      OFFSET $${index + 1}
    `;

    values.push(Number(limit), Number(offset));

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM blockchain.government_transactions gt
      ${whereClause}
    `;

    const countValues = values.slice(0, values.length - 2);

    const statsQuery = `
      SELECT
        COUNT(*) AS total_transactions,

        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(transaction_status, '')) IN
          ('APPROVED', 'COMPLETED', 'SUCCESS', 'PAID')
        ) AS approved_transactions,

        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(transaction_status, '')) IN
          ('PENDING', 'WAITING_APPROVAL', 'WAITING', 'DRAFT')
        ) AS pending_transactions,

        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(transaction_status, '')) IN
          ('FAILED', 'REJECTED', 'CANCELLED')
          OR UPPER(COALESCE(blockchain_status, '')) = 'FAILED'
        ) AS failed_transactions
      FROM blockchain.government_transactions
    `;

    const [dataResult, countResult, statsResult] = await Promise.all([
      pool.query(dataQuery, values),
      pool.query(countQuery, countValues),
      pool.query(statsQuery)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Government transactions loaded successfully from PostgreSQL',
      data: dataResult.rows,
      pagination: {
        total: Number(countResult.rows[0].total || 0),
        limit: Number(limit),
        offset: Number(offset)
      },
      stats: {
        totalTransactions: Number(statsResult.rows[0].total_transactions || 0),
        approved: Number(statsResult.rows[0].approved_transactions || 0),
        pending: Number(statsResult.rows[0].pending_transactions || 0),
        failed: Number(statsResult.rows[0].failed_transactions || 0)
      }
    });

  } catch (error) {
    console.error('[GOVERNMENT TRANSACTIONS LIST ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      column: error.column,
      table: error.table
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to load government transactions from PostgreSQL',
      error: error.message,
      code: error.code || null,
      detail: error.detail || null
    });
  }
});

module.exports = router;
