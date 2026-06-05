const express = require('express');
const router = express.Router();
let pool;

try {
  pool = require('../config/database');
} catch (error) {
  try {
    pool = require('../config/db');
  } catch (error2) {
    console.error('[DB CONFIG LOAD ERROR]', error2.message);
    throw error2;
  }
}
router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      status = 'ALL',
      blockchainStatus = 'ALL',
      limit = 50,
      offset = 0
    } = req.query;

    const conditions = [];
    const values = [];
    let index = 1;

    if (search && String(search).trim() !== '') {
      conditions.push(`
        (
          COALESCE(gt.transaction_reference::text, '') ILIKE $${index}
          OR COALESCE(gt.resident_full_name::text, '') ILIKE $${index}
          OR COALESCE(gt.resident_name::text, '') ILIKE $${index}
          OR COALESCE(gt.resident_wallet_address::text, '') ILIKE $${index}
          OR COALESCE(gt.resident_national_id::text, '') ILIKE $${index}
          OR COALESCE(gt.service_code::text, '') ILIKE $${index}
          OR COALESCE(gt.service_name::text, '') ILIKE $${index}
          OR COALESCE(gt.service_arabic_name::text, '') ILIKE $${index}
          OR COALESCE(gt.blockchain_tx_id::text, '') ILIKE $${index}
        )
      `);

      values.push(`%${String(search).trim()}%`);
      index++;
    }

    if (status && status !== 'ALL') {
      conditions.push(`UPPER(COALESCE(gt.transaction_status::text, '')) = UPPER($${index})`);
      values.push(status);
      index++;
    }

    if (blockchainStatus && blockchainStatus !== 'ALL') {
      conditions.push(`UPPER(COALESCE(gt.blockchain_status::text, '')) = UPPER($${index})`);
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

    const dataValues = [...values, Number(limit), Number(offset)];

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM blockchain.government_transactions gt
      ${whereClause}
    `;

    const statsQuery = `
      SELECT
        COUNT(*) AS total_transactions,

        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(transaction_status::text, '')) IN
          ('APPROVED', 'COMPLETED', 'SUCCESS', 'PAID')
        ) AS approved_transactions,

        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(transaction_status::text, '')) IN
          ('PENDING', 'WAITING_APPROVAL', 'WAITING', 'DRAFT', 'SUBMITTED', 'PROCESSING')
        ) AS pending_transactions,

        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(transaction_status::text, '')) IN
          ('FAILED', 'REJECTED', 'CANCELLED')
          OR UPPER(COALESCE(blockchain_status::text, '')) = 'FAILED'
        ) AS failed_transactions
      FROM blockchain.government_transactions
    `;

    const dataResult = await pool.query(dataQuery, dataValues);
    const countResult = await pool.query(countQuery, values);
    const statsResult = await pool.query(statsQuery);

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
      hint: error.hint,
      table: error.table,
      column: error.column
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to load government transactions from PostgreSQL',
      error: error.message,
      code: error.code || null,
      detail: error.detail || null,
      hint: error.hint || null
    });
  }
});

/**
 * GET /api/v1/government-blockchain/transactions/reference/transaction-status
 */
router.get('/reference/transaction-status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        status_code AS value,
        status_name AS label,
        description,
        display_order
      FROM blockchain.transaction_status
      WHERE is_active = TRUE
      ORDER BY display_order
    `);

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[TRANSACTION STATUS LOOKUP ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load transaction statuses',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/government-blockchain/transactions/reference/payment-methods
 */
router.get('/reference/payment-methods', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        method_code AS value,
        method_name AS label,
        description,
        display_order
      FROM blockchain.payment_method
      WHERE is_active = TRUE
      ORDER BY display_order
    `);

    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[PAYMENT METHOD LOOKUP ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load payment methods',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/government-blockchain/transactions/residents-dropdown
 *
 * Load residents from PostgreSQL for New Transaction dropdown.
 * Uses to_jsonb() to avoid errors when some optional columns do not exist.
 */
router.get('/residents-dropdown', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE(
          to_jsonb(r)->>'id',
          to_jsonb(r)->>'resident_db_id',
          to_jsonb(r)->>'resident_id'
        ) AS id,

        COALESCE(
          to_jsonb(r)->>'id',
          to_jsonb(r)->>'resident_db_id',
          to_jsonb(r)->>'resident_id'
        ) AS value,

        to_jsonb(r)->>'resident_id' AS resident_id,

        COALESCE(
          NULLIF(TRIM(CONCAT_WS(
            ' ',
            NULLIF(to_jsonb(r)->>'first_name', ''),
            NULLIF(to_jsonb(r)->>'father_name', ''),
            NULLIF(to_jsonb(r)->>'last_name', '')
          )), ''),
          to_jsonb(r)->>'full_name',
          to_jsonb(r)->>'resident_name',
          to_jsonb(r)->>'name',
          to_jsonb(r)->>'resident_id'
        ) AS full_name,

        COALESCE(
          to_jsonb(r)->>'wallet_address',
          to_jsonb(r)->>'walletAddress'
        ) AS wallet_address,

        COALESCE(
          to_jsonb(r)->>'national_id',
          to_jsonb(r)->>'national_id_number',
          to_jsonb(r)->>'national_number',
          to_jsonb(r)->>'identity_number',
          to_jsonb(r)->>'id_number',
          to_jsonb(r)->>'nationality'
        ) AS national_id_number,

        COALESCE(
          to_jsonb(r)->>'mobile',
          to_jsonb(r)->>'mobile_number',
          to_jsonb(r)->>'phone',
          to_jsonb(r)->>'phone_number'
        ) AS mobile_number,

        COALESCE(
          to_jsonb(r)->>'email',
          ''
        ) AS email,

        COALESCE(
          to_jsonb(r)->>'wallet_currency',
          'LBP'
        ) AS wallet_currency,

        COALESCE(
          to_jsonb(r)->>'wallet_status',
          'ACTIVE'
        ) AS wallet_status

      FROM blockchain.residents r
      WHERE to_jsonb(r)->>'resident_id' IS NOT NULL
      ORDER BY COALESCE(to_jsonb(r)->>'created_at', '') DESC
      LIMIT 500
    `);

    return res.json({
      success: true,
      message: 'Residents dropdown loaded successfully from PostgreSQL',
      data: result.rows
    });
  } catch (error) {
    console.error('[RESIDENTS DROPDOWN ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      column: error.column
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to load residents dropdown',
      error: error.message,
      code: error.code || null,
      detail: error.detail || null,
      hint: error.hint || null
    });
  }
});

/**
 * GET /api/v1/government-blockchain/transactions/services
 *
 * Load government services from PostgreSQL for New Transaction dropdown.
 * Uses to_jsonb() to avoid errors when optional columns do not exist.
 */
router.get('/services', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        CASE
          WHEN COALESCE(to_jsonb(gs)->>'service_id', '') ~ '^[0-9]+$'
          THEN (to_jsonb(gs)->>'service_id')::BIGINT
          ELSE NULL
        END AS service_id,

        COALESCE(
          to_jsonb(gs)->>'service_public_id',
          to_jsonb(gs)->>'public_id',
          to_jsonb(gs)->>'service_code'
        ) AS service_public_id,

        COALESCE(
          to_jsonb(gs)->>'service_code',
          to_jsonb(gs)->>'code'
        ) AS service_code,

        COALESCE(
          to_jsonb(gs)->>'service_name',
          to_jsonb(gs)->>'name'
        ) AS service_name,

        COALESCE(
          to_jsonb(gs)->>'arabic_name',
          to_jsonb(gs)->>'service_arabic_name',
          ''
        ) AS arabic_name,

        COALESCE(
          to_jsonb(gs)->>'ministry_id',
          to_jsonb(gs)->>'ministry_code',
          to_jsonb(gs)->>'ministry_name'
        ) AS ministry_id,

        COALESCE(
          to_jsonb(gs)->>'administration_id',
          ''
        ) AS administration_id,

        COALESCE(
          to_jsonb(gs)->>'category_id',
          ''
        ) AS category_id,

        CASE
          WHEN COALESCE(to_jsonb(gs)->>'fee_amount', to_jsonb(gs)->>'service_fee', '0') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN COALESCE(to_jsonb(gs)->>'fee_amount', to_jsonb(gs)->>'service_fee', '0')::NUMERIC
          ELSE 0
        END AS fee_amount,

        COALESCE(
          to_jsonb(gs)->>'currency_code',
          to_jsonb(gs)->>'currency',
          'LBP'
        ) AS currency_code,

        CASE
          WHEN LOWER(COALESCE(to_jsonb(gs)->>'digital_stamp_required', 'false')) IN ('true', '1', 'yes')
          THEN TRUE
          ELSE FALSE
        END AS digital_stamp_required,

        COALESCE(
          to_jsonb(gs)->>'processing_time',
          ''
        ) AS processing_time

      FROM blockchain.government_services gs
      WHERE COALESCE(
        NULLIF(LOWER(to_jsonb(gs)->>'is_active'), ''),
        'true'
      ) NOT IN ('false', '0', 'no', 'inactive')
      ORDER BY COALESCE(to_jsonb(gs)->>'service_name', to_jsonb(gs)->>'name', '') ASC
    `);

    return res.json({
      success: true,
      message: 'Government services loaded successfully from PostgreSQL',
      data: result.rows
    });
  } catch (error) {
    console.error('[GOVERNMENT SERVICES DROPDOWN ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      column: error.column
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to load government services dropdown',
      error: error.message,
      code: error.code || null,
      detail: error.detail || null,
      hint: error.hint || null
    });
  }
});



/**
 * POST /api/v1/government-blockchain/transactions
 *
 * Create a government transaction in PostgreSQL.
 */
router.post('/', async (req, res) => {
  try {
    const {
      resident = {},
      service = {},
      transaction = {},
      documents = [],
      createdBy = {}
    } = req.body || {};

    const transactionReference =
      transaction.clientTransactionId && String(transaction.clientTransactionId).startsWith('GOV-TXN-')
        ? transaction.clientTransactionId
        : `GOV-TXN-${Date.now()}`;

    const documentHash =
      transaction.documentHash ||
      documents?.find?.(doc => doc.hash && doc.hash !== 'Pending generation')?.hash ||
      null;

    const uploadedDocumentsCount = Array.isArray(documents) ? documents.length : 0;

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
        uploaded_documents_count,
        digital_stamp_required,

        created_by_account_type,
        created_by_login_username,
        created_by_wallet_address,

        blockchain_status,
        blockchain_error,
        created_at,
        updated_at
      )
      VALUES (
        $1,

        $2, $3, $4, $5, $6, $7,

        $8, $9, $10, $11, $12, $13, $14, $15,

        $16, $17, $18, $19, $20,

        $21, $22, $23, $24,

        $25, $26, $27,

        $28, $29, NOW(), NOW()
      )
      RETURNING *
      `,
      [
        transactionReference,

        resident.residentId || null,
        resident.walletAddress || null,
        resident.fullName || null,
        resident.nationalId || null,
        resident.mobile || null,
        resident.email || null,

        service.serviceId || null,
        service.servicePublicId || null,
        service.serviceCode || null,
        service.serviceName || null,
        service.arabicName || null,
        service.ministryId || null,
        service.administrationId || null,
        service.categoryId || null,

        transaction.amount || service.fee_amount || 0,
        transaction.currencyCode || service.currency_code || 'LBP',
        transaction.paymentMethod || null,
        transaction.transactionType || 'GOVERNMENT_SERVICE',
        transaction.transactionStatus || 'DRAFT',

        transaction.notes || null,
        documentHash,
        uploadedDocumentsCount,
        service.digitalStampRequired || false,

        createdBy.accountType || 'PUBLIC_ADMINISTRATION',
        createdBy.loginUsername || 'system',
        createdBy.walletAddress || null,

        'PENDING',
        null
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Government transaction saved successfully in PostgreSQL',
      transactionReference: insertResult.rows[0].transaction_reference,
      blockchainStatus: insertResult.rows[0].blockchain_status,
      data: insertResult.rows[0]
    });
  } catch (error) {
    console.error('[CREATE GOVERNMENT TRANSACTION ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      column: error.column
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to create government transaction',
      error: error.message,
      code: error.code || null,
      detail: error.detail || null,
      hint: error.hint || null
    });
  }
});


/**
 * GET /api/v1/government-blockchain/transactions/ministries-dropdown
 *
 * Load ministries from blockchain.government_ministries.
 */
router.get('/ministries-dropdown', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        gm.ministry_id::text AS value,
        gm.ministry_id::text AS ministry_id,
        gm.ministry_reference_id,
        gm.ministry_code,
        gm.ministry_name AS label,
        gm.ministry_name,
        gm.arabic_name,
        gm.ministry_type,
        gm.parent_ministry
      FROM blockchain.government_ministries gm
      ORDER BY gm.ministry_name ASC
    `);

    return res.json({
      success: true,
      message: 'Ministries dropdown loaded successfully from PostgreSQL',
      data: result.rows
    });
  } catch (error) {
    console.error('[MINISTRIES DROPDOWN ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      column: error.column
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to load ministries dropdown',
      error: error.message,
      code: error.code || null,
      detail: error.detail || null,
      hint: error.hint || null
    });
  }
});

module.exports = router;
