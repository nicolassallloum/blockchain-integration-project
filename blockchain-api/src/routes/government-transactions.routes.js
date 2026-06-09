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

const PAYMENT_METHODS = {
  RESIDENT_WALLET: 'RESIDENT_WALLET',
  DIGITAL_STAMP_WALLET: 'DIGITAL_STAMP_WALLET',
  BANK_CARD: 'BANK_CARD',
  CASH_OFFICE_PAYMENT: 'CASH_OFFICE_PAYMENT',
  GOVERNMENT_PAYMENT_GATEWAY: 'GOVERNMENT_PAYMENT_GATEWAY'
};

function cleanText(value) {
  return String(value || '').trim();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function calculateFees(baseFee, paymentMethod) {
  const cleanBaseFee = roundMoney(baseFee);

  let feePercentage = 0;

  if (paymentMethod === PAYMENT_METHODS.CASH_OFFICE_PAYMENT) {
    feePercentage = 5;
  }

  if (paymentMethod === PAYMENT_METHODS.GOVERNMENT_PAYMENT_GATEWAY) {
    feePercentage = 10;
  }

  const feeExtraAmount = roundMoney(cleanBaseFee * feePercentage / 100);
  const totalFee = roundMoney(cleanBaseFee + feeExtraAmount);

  return {
    baseFee: cleanBaseFee,
    feePercentage,
    feeExtraAmount,
    totalFee,
    currency: 'GOV'
  };
}

function sanitizeBankCardDetails(details = {}) {
  const cardNumber = cleanText(details.cardNumber || details.card_number);
  const last4 = cardNumber ? cardNumber.replace(/\D/g, '').slice(-4) : null;

  return {
    cardholderName: cleanText(details.cardholderName || details.cardholder_name),
    cardLast4: last4,
    expiryDate: cleanText(details.expiryDate || details.expiry_date),
    billingReference: cleanText(details.billingReference || details.billing_reference),
    cardNumberStored: false,
    cvvStored: false
  };
}

function getClientDetails(req) {
  return {
    ip: req.ip || req.headers['x-forwarded-for'] || null,
    userAgent: req.headers['user-agent'] || null,
    requestId: req.headers['x-request-id'] || null
  };
}

/**
 * GET /api/v1/government-blockchain/transactions
 *
 * Query filters supported:
 * - search
 * - transactionId
 * - residentName
 * - service
 * - paymentMethod
 * - status
 * - blockchainStatus
 * - dateFrom
 * - dateTo
 * - limit
 * - offset
 */
router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      transactionId = '',
      residentName = '',
      service = '',
      paymentMethod = 'ALL',
      status = 'ALL',
      blockchainStatus = 'ALL',
      dateFrom = '',
      dateTo = '',
      limit = 50,
      offset = 0
    } = req.query;

    const conditions = [];
    const values = [];
    let index = 1;

    const addIlikeCondition = (sqlExpression, value) => {
      const cleanValue = cleanText(value);
      if (!cleanValue) {
        return;
      }

      conditions.push(`${sqlExpression} ILIKE $${index}`);
      values.push(`%${cleanValue}%`);
      index++;
    };

    if (cleanText(search)) {
      conditions.push(`
        (
          COALESCE(gt.transaction_reference::text, '') ILIKE $${index}
          OR COALESCE(gt.transaction_id::text, '') ILIKE $${index}
          OR COALESCE(gt.resident_full_name::text, '') ILIKE $${index}
          OR COALESCE(gt.resident_name::text, '') ILIKE $${index}
          OR COALESCE(r.full_name::text, '') ILIKE $${index}
          OR COALESCE(gt.resident_wallet_address::text, '') ILIKE $${index}
          OR COALESCE(gt.resident_national_id::text, '') ILIKE $${index}
          OR COALESCE(gt.service_code::text, '') ILIKE $${index}
          OR COALESCE(gt.service_name::text, '') ILIKE $${index}
          OR COALESCE(gs.service_name::text, '') ILIKE $${index}
          OR COALESCE(gt.service_arabic_name::text, '') ILIKE $${index}
          OR COALESCE(pa.administration_name::text, '') ILIKE $${index}
          OR COALESCE(gt.blockchain_tx_id::text, '') ILIKE $${index}
        )
      `);

      values.push(`%${cleanText(search)}%`);
      index++;
    }

    addIlikeCondition(`COALESCE(gt.transaction_reference::text, gt.transaction_id::text, '')`, transactionId);

    if (cleanText(residentName)) {
      conditions.push(`
        (
          COALESCE(gt.resident_full_name::text, '') ILIKE $${index}
          OR COALESCE(gt.resident_name::text, '') ILIKE $${index}
          OR COALESCE(r.full_name::text, '') ILIKE $${index}
        )
      `);
      values.push(`%${cleanText(residentName)}%`);
      index++;
    }

    if (cleanText(service)) {
      conditions.push(`
        (
          COALESCE(gt.service_name::text, '') ILIKE $${index}
          OR COALESCE(gt.service_code::text, '') ILIKE $${index}
          OR COALESCE(gs.service_name::text, '') ILIKE $${index}
          OR COALESCE(gs.service_code::text, '') ILIKE $${index}
          OR COALESCE(gs.service_public_id::text, '') ILIKE $${index}
        )
      `);
      values.push(`%${cleanText(service)}%`);
      index++;
    }

    if (paymentMethod && paymentMethod !== 'ALL') {
      conditions.push(`UPPER(COALESCE(gt.payment_method::text, '')) = UPPER($${index})`);
      values.push(cleanText(paymentMethod));
      index++;
    }

    if (status && status !== 'ALL') {
      conditions.push(`UPPER(COALESCE(gt.transaction_status::text, '')) = UPPER($${index})`);
      values.push(cleanText(status));
      index++;
    }

    if (blockchainStatus && blockchainStatus !== 'ALL') {
      conditions.push(`UPPER(COALESCE(gt.blockchain_status::text, '')) = UPPER($${index})`);
      values.push(cleanText(blockchainStatus));
      index++;
    }

    if (cleanText(dateFrom)) {
      conditions.push(`gt.created_at::date >= $${index}::date`);
      values.push(cleanText(dateFrom));
      index++;
    }

    if (cleanText(dateTo)) {
      conditions.push(`gt.created_at::date <= $${index}::date`);
      values.push(cleanText(dateTo));
      index++;
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const fromJoinClause = `
      FROM blockchain.government_transactions gt

      LEFT JOIN LATERAL (
        SELECT
          r.id,
          r.resident_id,
          r.full_name,
          r.wallet_address,
          r.national_id_number,
          r.mobile_number,
          r.email
        FROM blockchain.residents r
        WHERE
          r.id = gt.resident_db_id
          OR r.resident_id = gt.resident_id
          OR UPPER(COALESCE(r.wallet_address, '')) = UPPER(COALESCE(gt.resident_wallet_address, ''))
        ORDER BY r.id DESC
        LIMIT 1
      ) r ON TRUE

      LEFT JOIN LATERAL (
        SELECT
          gs.service_id,
          gs.service_public_id,
          gs.service_code,
          gs.service_name,
          gs.arabic_name,
          gs.category_id,
          gs.ministry_id,
          gs.administration_id,
          gs.fee_amount
        FROM blockchain.government_services gs
        WHERE
          gs.service_id = gt.service_id
          OR gs.service_public_id = gt.service_public_id
          OR gs.service_code = gt.service_code
        ORDER BY gs.service_id DESC
        LIMIT 1
      ) gs ON TRUE

      LEFT JOIN LATERAL (
        SELECT
          pa.administration_id,
          pa.administration_name
        FROM blockchain.public_administrations pa
        WHERE pa.administration_id::text = COALESCE(gt.administration_id::text, gs.administration_id::text)
        ORDER BY pa.administration_id DESC
        LIMIT 1
      ) pa ON TRUE
    `;

    const dataQuery = `
      SELECT
        gt.transaction_id,

        COALESCE(gt.transaction_reference, gt.transaction_id::text) AS transaction_reference,

        gt.resident_id,
        gt.resident_db_id,
        gt.resident_wallet_address,
        COALESCE(gt.resident_full_name, gt.resident_name, r.full_name, '-') AS resident_name,
        COALESCE(gt.resident_full_name, gt.resident_name, r.full_name, '-') AS resident_full_name,
        COALESCE(gt.resident_national_id, r.national_id_number) AS resident_national_id,
        COALESCE(gt.resident_mobile, r.mobile_number) AS resident_mobile,
        COALESCE(gt.resident_email, r.email) AS resident_email,

        gt.service_id,
        COALESCE(gt.service_public_id, gs.service_public_id) AS service_public_id,
        COALESCE(gt.service_code, gs.service_code) AS service_code,
        COALESCE(gt.service_name, gs.service_name, '-') AS service_name,
        COALESCE(gt.service_arabic_name, gs.arabic_name) AS service_arabic_name,
        gt.service_category,
        COALESCE(gt.category_id::text, gs.category_id::text) AS category_id,

        COALESCE(gt.ministry_id::text, gs.ministry_id::text) AS ministry_id,
        gt.ministry_name,

        COALESCE(gt.administration_id::text, gs.administration_id::text) AS administration_id,
        COALESCE(pa.administration_name, '-') AS administration_name,

        COALESCE(gt.amount, 0)::NUMERIC AS amount,
        COALESCE(gt.base_fee, gt.amount, 0)::NUMERIC AS base_fee,
        COALESCE(gt.fee_extra_amount, 0)::NUMERIC AS fee_extra_amount,
        COALESCE(gt.fee_percentage, 0)::NUMERIC AS fee_percentage,

        COALESCE(
          NULLIF(gt.total_fee, 0),
          gt.amount,
          gs.fee_amount,
          0
        )::NUMERIC AS total_fees,

        COALESCE(
          NULLIF(gt.total_fee, 0),
          gt.amount,
          gs.fee_amount,
          0
        )::NUMERIC AS total_fee,

        'GOV' AS currency_code,
        'GOV' AS currency,

        COALESCE(gt.payment_method, '-') AS payment_method,
        gt.payment_details,
        gt.digital_stamp_payment_ref,
        gt.digital_stamp_id,

        COALESCE(gt.transaction_type, 'GOVERNMENT_SERVICE') AS transaction_type,
        COALESCE(gt.transaction_status, 'PENDING') AS transaction_status,

        gt.notes,
        gt.document_hash,
        gt.digital_stamp_required,
        gt.uploaded_documents_count,

        gt.created_by_account_type,
        gt.created_by_login_username,
        gt.created_by_wallet_address,

        gt.blockchain_tx_id,
        COALESCE(gt.blockchain_status, 'PENDING') AS blockchain_status,
        gt.blockchain_error,
        gt.blockchain_submitted_at,

        gt.created_at,
        gt.updated_at
      ${fromJoinClause}
      ${whereClause}
      ORDER BY gt.created_at DESC NULLS LAST, gt.transaction_id DESC
      LIMIT $${index}
      OFFSET $${index + 1}
    `;

    const dataValues = [...values, Number(limit), Number(offset)];

    const countQuery = `
      SELECT COUNT(*) AS total
      ${fromJoinClause}
      ${whereClause}
    `;

    const statsQuery = `
      SELECT
        COUNT(*) AS total_transactions,
        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(gt.transaction_status::text, '')) IN
          ('APPROVED', 'COMPLETED', 'SUCCESS', 'PAID')
        ) AS approved_transactions,
        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(gt.transaction_status::text, '')) IN
          ('PENDING', 'WAITING_APPROVAL', 'WAITING', 'DRAFT', 'SUBMITTED', 'PROCESSING', 'PENDING_REVIEW', 'PENDING_APPROVAL')
        ) AS pending_transactions,
        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(gt.transaction_status::text, '')) IN
          ('FAILED', 'REJECTED', 'CANCELLED')
          OR UPPER(COALESCE(gt.blockchain_status::text, '')) = 'FAILED'
        ) AS failed_transactions
      FROM blockchain.government_transactions gt
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
      },
      filters: {
        search,
        transactionId,
        residentName,
        service,
        paymentMethod,
        status,
        blockchainStatus,
        dateFrom,
        dateTo
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
 */
router.get('/residents-dropdown', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        r.id AS id,
        r.id AS value,
        r.resident_id,
        r.full_name,
        r.wallet_address,
        r.national_id_number,
        r.mobile_number,
        r.email,
        'GOV' AS wallet_currency,
        COALESCE(rw.wallet_status, r.wallet_status, 'ACTIVE') AS wallet_status,
        COALESCE(rw.wallet_balance, 0)::NUMERIC AS wallet_balance
      FROM blockchain.residents r
      LEFT JOIN blockchain.resident_wallets rw
        ON rw.resident_id = r.resident_id
        OR UPPER(rw.wallet_address) = UPPER(r.wallet_address)
      WHERE r.resident_id IS NOT NULL
      ORDER BY r.full_name ASC
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
 */
router.get('/services', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        gs.service_id AS service_id,
        gs.service_public_id,
        gs.service_code,
        gs.service_name,
        COALESCE(gs.arabic_name, '') AS arabic_name,
        gs.ministry_id::TEXT AS ministry_id,
        COALESCE(gs.administration_id::TEXT, '') AS administration_id,
        COALESCE(gs.category_id::TEXT, '') AS category_id,
        COALESCE(gs.fee_amount, 0)::NUMERIC AS fee_amount,
        'GOV' AS currency_code,
        COALESCE(gs.digital_stamp_required, FALSE) AS digital_stamp_required,
        COALESCE(gs.processing_time, '') AS processing_time
      FROM blockchain.government_services gs
      WHERE UPPER(COALESCE(gs.service_status, 'ACTIVE')) IN ('ACTIVE', 'APPROVED', 'PUBLISHED')
      AND COALESCE(gs.fee_amount, 0) > 0
      ORDER BY gs.service_name ASC
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
 * POST /api/v1/government-blockchain/transactions/fee-preview
 */
router.post('/fee-preview', async (req, res) => {
  try {
    const paymentMethod = cleanText(req.body?.paymentMethod).toUpperCase();
    const baseFee = toNumber(req.body?.baseFee || req.body?.feeAmount, 0);

    if (!Object.values(PAYMENT_METHODS).includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method.'
      });
    }

    return res.json({
      success: true,
      data: calculateFees(baseFee, paymentMethod)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate fee preview',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/government-blockchain/transactions
 */
router.post('/', async (req, res) => {
  let client = null;
  let useTransaction = false;

  try {
    if (typeof pool.connect === 'function') {
      client = await pool.connect();
      useTransaction = true;
    } else {
      client = {
        query: (...args) => pool.query(...args),
        release: () => {}
      };
    }
    const {
      resident = {},
      service = {},
      transaction = {},
      documents = [],
      createdBy = {}
    } = req.body || {};

    const residentId = cleanText(resident.residentId);
    const serviceId = toNumber(service.serviceId, 0);
    const paymentMethod = cleanText(transaction.paymentMethod).toUpperCase();

    if (!residentId) {
      return res.status(400).json({
        success: false,
        message: 'Resident ID is required.'
      });
    }

    if (!serviceId) {
      return res.status(400).json({
        success: false,
        message: 'Service ID is required.'
      });
    }

    if (!Object.values(PAYMENT_METHODS).includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method.',
        allowedPaymentMethods: Object.values(PAYMENT_METHODS)
      });
    }

    if (useTransaction) {
      await client.query('BEGIN');
    }

    const residentResult = await client.query(
      `
      SELECT
        r.id,
        r.resident_id,
        r.full_name,
        r.wallet_address,
        r.national_id_number,
        r.mobile_number,
        r.email,
        COALESCE(rw.wallet_balance, 0)::NUMERIC AS wallet_balance,
        COALESCE(rw.wallet_status, r.wallet_status, 'ACTIVE') AS wallet_status
      FROM blockchain.residents r
      LEFT JOIN blockchain.resident_wallets rw
        ON rw.resident_id = r.resident_id
        OR UPPER(rw.wallet_address) = UPPER(r.wallet_address)
      WHERE r.resident_id = $1
      LIMIT 1
      `,
      [residentId]
    );

    if (residentResult.rowCount === 0) {
      if (useTransaction) {
        await client.query('ROLLBACK');
      }

      return res.status(404).json({
        success: false,
        message: 'Resident not found.'
      });
    }

    const dbResident = residentResult.rows[0];

    const serviceResult = await client.query(
      `
      SELECT
        gs.service_id,
        gs.service_public_id,
        gs.service_code,
        gs.service_name,
        gs.arabic_name,
        gs.ministry_id::TEXT AS ministry_id,
        COALESCE(gs.administration_id::TEXT, '') AS administration_id,
        COALESCE(gs.category_id::TEXT, '') AS category_id,
        COALESCE(gs.fee_amount, 0)::NUMERIC AS fee_amount,
        COALESCE(gs.digital_stamp_required, FALSE) AS digital_stamp_required
      FROM blockchain.government_services gs
      WHERE gs.service_id = $1
      LIMIT 1
      `,
      [serviceId]
    );

    if (serviceResult.rowCount === 0) {
      if (useTransaction) {
        await client.query('ROLLBACK');
      }

      return res.status(404).json({
        success: false,
        message: 'Government service not found.'
      });
    }

    const dbService = serviceResult.rows[0];
    const feeBreakdown = calculateFees(dbService.fee_amount, paymentMethod);

    let paymentDetails = {
      method: paymentMethod,
      currency: 'GOV',
      feeBreakdown,
      client: getClientDetails(req)
    };

    let digitalStampRecord = null;

    if (paymentMethod === PAYMENT_METHODS.RESIDENT_WALLET) {
      const walletBalance = toNumber(dbResident.wallet_balance, 0);

      if (walletBalance < feeBreakdown.totalFee) {
        if (useTransaction) {
        await client.query('ROLLBACK');
      }

        return res.status(400).json({
          success: false,
          message: 'Resident wallet balance is not enough for this transaction.',
          data: {
            walletBalance,
            requiredAmount: feeBreakdown.totalFee,
            currency: 'GOV'
          }
        });
      }

      paymentDetails.wallet = {
        walletAddress: dbResident.wallet_address,
        walletBalanceBefore: walletBalance,
        requiredAmount: feeBreakdown.totalFee,
        balanceValidated: true
      };
    }

    if (paymentMethod === PAYMENT_METHODS.DIGITAL_STAMP_WALLET) {
      const paymentCode = cleanText(
        transaction.paymentCode ||
        transaction.payment_code ||
        transaction.digitalStampPaymentCode
      );

      if (!paymentCode) {
        if (useTransaction) {
        await client.query('ROLLBACK');
      }

        return res.status(400).json({
          success: false,
          message: 'Payment Code is required for Digital Stamp Wallet.'
        });
      }

      const stampResult = await client.query(
        `
        SELECT *
        FROM blockchain.digital_stamp_payments
        WHERE (
          UPPER(payment_ref) = UPPER($1)
          OR UPPER(stamp_id) = UPPER($1)
        )
        AND UPPER(payment_status) IN ('PAID', 'SUCCESS', 'COMPLETED')
        AND UPPER(stamp_status) IN ('ISSUED', 'ACTIVE')
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
        `,
        [paymentCode]
      );

      if (stampResult.rowCount === 0) {
        if (useTransaction) {
        await client.query('ROLLBACK');
      }

        return res.status(400).json({
          success: false,
          message: 'Invalid payment code. No issued/active digital stamp was found.'
        });
      }

      digitalStampRecord = stampResult.rows[0];

      await client.query(
        `
        UPDATE blockchain.digital_stamp_payments
        SET
          stamp_status = 'Redeemed',
          updated_at = NOW()
        WHERE id = $1
        `,
        [digitalStampRecord.id]
      );

      paymentDetails.digitalStamp = {
        paymentCode,
        paymentRef: digitalStampRecord.payment_ref,
        stampId: digitalStampRecord.stamp_id,
        stampStatusBefore: digitalStampRecord.stamp_status,
        stampStatusAfter: 'Redeemed'
      };
    }

    if (paymentMethod === PAYMENT_METHODS.BANK_CARD) {
      const bankCardDetails = sanitizeBankCardDetails(transaction.bankCard || transaction.bank_card || {});

      if (
        !bankCardDetails.cardholderName ||
        !bankCardDetails.cardLast4 ||
        !bankCardDetails.expiryDate ||
        !bankCardDetails.billingReference
      ) {
        if (useTransaction) {
        await client.query('ROLLBACK');
      }

        return res.status(400).json({
          success: false,
          message: 'Cardholder Name, Card Number, Expiry Date, and Billing Reference are required for Bank Card payment.'
        });
      }

      paymentDetails.bankCard = bankCardDetails;
    }

    if (paymentMethod === PAYMENT_METHODS.CASH_OFFICE_PAYMENT) {
      paymentDetails.cashOfficePayment = {
        surchargeApplied: true,
        surchargePercentage: 5
      };
    }

    if (paymentMethod === PAYMENT_METHODS.GOVERNMENT_PAYMENT_GATEWAY) {
      paymentDetails.governmentPaymentGateway = {
        gatewayFeeApplied: true,
        gatewayFeePercentage: 10
      };
    }

    const calculatedTransactionStatus =
      feeBreakdown.totalFee < 10000000
        ? 'APPROVED'
        : 'PENDING_REVIEW';

    const transactionReference =
      transaction.clientTransactionId && String(transaction.clientTransactionId).startsWith('GOV-TXN-')
        ? transaction.clientTransactionId
        : `GOV-TXN-${Date.now()}`;

    const documentHash =
      transaction.documentHash ||
      documents?.find?.(doc => doc.hash && doc.hash !== 'Pending generation')?.hash ||
      null;

    const uploadedDocumentsCount = Array.isArray(documents) ? documents.length : 0;

    const insertResult = await client.query(
      `
      INSERT INTO blockchain.government_transactions (
        transaction_reference,

        resident_id,
        resident_db_id,
        resident_wallet_address,
        resident_full_name,
        resident_name,
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
        base_fee,
        fee_extra_amount,
        fee_percentage,
        total_fee,
        currency,
        currency_code,
        payment_method,
        payment_details,
        digital_stamp_payment_ref,
        digital_stamp_id,
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

        $2, $3, $4, $5, $6, $7, $8, $9,

        $10, $11, $12, $13, $14, $15, $16, $17,

        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,

        $31, $32, $33, $34,

        $35, $36, $37,

        $38, $39, NOW(), NOW()
      )
      RETURNING *
      `,
      [
        transactionReference,

        dbResident.resident_id,
        dbResident.id,
        dbResident.wallet_address,
        dbResident.full_name,
        dbResident.full_name,
        dbResident.national_id_number,
        dbResident.mobile_number,
        dbResident.email,

        dbService.service_id,
        dbService.service_public_id,
        dbService.service_code,
        dbService.service_name,
        dbService.arabic_name,
        dbService.ministry_id,
        dbService.administration_id,
        dbService.category_id,

        feeBreakdown.totalFee,
        feeBreakdown.baseFee,
        feeBreakdown.feeExtraAmount,
        feeBreakdown.feePercentage,
        feeBreakdown.totalFee,
        'GOV',
        'GOV',
        paymentMethod,
        JSON.stringify(paymentDetails),
        digitalStampRecord?.payment_ref || null,
        digitalStampRecord?.stamp_id || null,
        transaction.transactionType || 'GOVERNMENT_SERVICE',
        calculatedTransactionStatus,

        transaction.notes || null,
        documentHash,
        uploadedDocumentsCount,
        dbService.digital_stamp_required || false,

        createdBy.accountType || 'PUBLIC_ADMINISTRATION',
        createdBy.loginUsername || 'system',
        createdBy.walletAddress || null,

        'PENDING',
        null
      ]
    );

    if (useTransaction) {
      await client.query('COMMIT');
    }

    return res.status(201).json({
      success: true,
      message:
        calculatedTransactionStatus === 'APPROVED'
          ? 'Government transaction created and auto approved successfully.'
          : 'Government transaction saved successfully as Pending Review.',
      transactionReference: insertResult.rows[0].transaction_reference,
      transactionStatus: insertResult.rows[0].transaction_status,
      autoApprovalLimit: 10000000,
      autoApproved: calculatedTransactionStatus === 'APPROVED',
      blockchainStatus: insertResult.rows[0].blockchain_status,
      currency: 'GOV',
      feeBreakdown,
      paymentMethod,
      data: insertResult.rows[0]
    });
  } catch (error) {
    try {
      if (useTransaction) {
        await client.query('ROLLBACK');
      }
    } catch (rollbackError) {
      console.error('[CREATE GOVERNMENT TRANSACTION ROLLBACK ERROR]', rollbackError);
    }

    console.error('[CREATE GOVERNMENT TRANSACTION ERROR]', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      table: error.table,
      column: error.column,
      constraint: error.constraint
    })

    return res.status(500).json({
      success: false,
      message: 'Failed to create government transaction',
      error: error.message,
      code: error.code || null,
      detail: error.detail || null,
      hint: error.hint || null
    });
  } finally {
    if (client && typeof client.release === 'function') {
      client.release();
    }
  }
});

/**
 * GET /api/v1/government-blockchain/transactions/ministries-dropdown
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
