const express = require('express');
const router = express.Router();
const pool = require('../config/database');

function generatePaymentCode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `GOV-STAMP-${y}${m}${d}-${timestamp}-${random}`;
}

function cleanNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

/**
 * GET /api/v1/government-blockchain/payments-digital-stamps
 * List all payment and digital stamp records.
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        payment_ref,
        resident_name,
        service_name,
        stamp_id,
        amount,
        currency_code,
        payment_status,
        stamp_status,
        created_at
      FROM blockchain.digital_stamp_payments
      ORDER BY created_at DESC, id DESC
    `);

    return res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('[DIGITAL STAMPS LIST ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load payment and digital stamp records',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/government-blockchain/payments-digital-stamps/summary
 * Summary cards for Payments / Digital Stamps screen.
 */
router.get('/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::BIGINT AS total_payments,
        COALESCE(SUM(amount), 0)::NUMERIC AS total_amount,
        COUNT(CASE WHEN UPPER(stamp_status) IN ('ISSUED', 'ACTIVE', 'REDEEMED') THEN 1 END)::BIGINT AS digital_stamps,
        COUNT(CASE WHEN UPPER(stamp_status) = 'REDEEMED' THEN 1 END)::BIGINT AS redeemed
      FROM blockchain.digital_stamp_payments
    `);

    const row = result.rows[0] || {};

    return res.json({
      success: true,
      data: {
        totalPayments: Number(row.total_payments || 0),
        totalAmount: Number(row.total_amount || 0),
        digitalStamps: Number(row.digital_stamps || 0),
        redeemed: Number(row.redeemed || 0),
        currencyCode: 'GOV'
      }
    });
  } catch (error) {
    console.error('[DIGITAL STAMPS SUMMARY ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load payment and digital stamp summary',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/government-blockchain/payments-digital-stamps/residents/dropdown
 *
 * Required SQL:
 * SELECT id AS id, full_name AS name
 * FROM blockchain.residents
 * ORDER BY full_name;
 */
router.get('/residents/dropdown', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id AS id,
        full_name AS name
      FROM blockchain.residents
      WHERE full_name IS NOT NULL
      ORDER BY full_name
    `);

    return res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('[PAYMENTS RESIDENTS DROPDOWN ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load residents dropdown',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/government-blockchain/payments-digital-stamps/services/dropdown
 *
 * Required SQL:
 * SELECT service_id AS id, service_name AS name
 * FROM blockchain.government_services
 * ORDER BY service_name;
 */
router.get('/services/dropdown', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        service_id AS id,
        service_name AS name
      FROM blockchain.government_services
      WHERE service_name IS NOT NULL
      ORDER BY service_name
    `);

    return res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('[PAYMENTS SERVICES DROPDOWN ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load services dropdown',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/government-blockchain/payments-digital-stamps/services/:serviceId/fees
 *
 * Required SQL:
 * SELECT service_id AS id, service_name AS name, fee_amount AS fees
 * FROM blockchain.government_services
 * WHERE service_id = $1;
 */
router.get('/services/:serviceId/fees', async (req, res) => {
  try {
    const serviceId = cleanNumber(req.params.serviceId);

    if (!serviceId) {
      return res.status(400).json({
        success: false,
        message: 'Valid serviceId is required'
      });
    }

    const result = await pool.query(
      `
      SELECT
        service_id AS id,
        service_name AS name,
        fee_amount AS fees
      FROM blockchain.government_services
      WHERE service_id = $1
      `,
      [serviceId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[PAYMENTS SERVICE FEES ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load service fees',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/government-blockchain/payments-digital-stamps/issue
 *
 * Issue digital stamp from resident + government service.
 * Currency is always GOV.
 */
router.post('/issue', async (req, res) => {
  const client = await pool.getClient();

  try {
    const residentId = cleanNumber(
      req.body?.residentId ||
      req.body?.resident_id
    );

    const serviceId = cleanNumber(
      req.body?.serviceId ||
      req.body?.service_id
    );

    const requestedStatus = String(
      req.body?.stampStatus ||
      req.body?.stamp_status ||
      'Issued'
    ).trim();

    const stampStatus = requestedStatus.toLowerCase() === 'active'
      ? 'Active'
      : 'Issued';

    if (!residentId || !serviceId) {
      return res.status(400).json({
        success: false,
        message: 'residentId and serviceId are required'
      });
    }

    await client.query('BEGIN');

    const residentResult = await client.query(
      `
      SELECT
        id,
        full_name
      FROM blockchain.residents
      WHERE id = $1
      `,
      [residentId]
    );

    if (residentResult.rowCount === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Resident not found'
      });
    }

    const serviceResult = await client.query(
      `
      SELECT
        service_id,
        service_name,
        fee_amount
      FROM blockchain.government_services
      WHERE service_id = $1
      `,
      [serviceId]
    );

    if (serviceResult.rowCount === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Government service not found'
      });
    }

    const resident = residentResult.rows[0];
    const service = serviceResult.rows[0];

    const fees = Number(service.fee_amount || 0);

    if (!Number.isFinite(fees) || fees <= 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Selected service has invalid fee amount'
      });
    }

    let paymentCode = generatePaymentCode();
    let stampId = paymentCode;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const duplicateCheck = await client.query(
        `
        SELECT id
        FROM blockchain.digital_stamp_payments
        WHERE UPPER(payment_ref) = UPPER($1)
           OR UPPER(stamp_id) = UPPER($1)
        LIMIT 1
        `,
        [paymentCode]
      );

      if (duplicateCheck.rowCount === 0) {
        break;
      }

      paymentCode = generatePaymentCode();
      stampId = paymentCode;
    }

    const insertResult = await client.query(
      `
      INSERT INTO blockchain.digital_stamp_payments
      (
        payment_ref,
        resident_name,
        service_name,
        stamp_id,
        amount,
        currency_code,
        payment_status,
        stamp_status
      )
      VALUES ($1, $2, $3, $4, $5, 'GOV', 'Paid', $6)
      RETURNING
        id,
        payment_ref,
        resident_name,
        service_name,
        stamp_id,
        amount,
        currency_code,
        payment_status,
        stamp_status,
        created_at
      `,
      [
        paymentCode,
        resident.full_name,
        service.service_name,
        stampId,
        fees,
        stampStatus
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Digital stamp issued successfully',
      data: {
        ...insertResult.rows[0],
        resident_id: resident.id,
        service_id: service.service_id,
        payment_code: paymentCode,
        currency_code: 'GOV'
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('[DIGITAL STAMP ISSUE ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to issue digital stamp',
      error: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * Backward-compatible old POST.
 * Keeps existing screen/tests working if something still calls POST /payments-digital-stamps.
 */
router.post('/', async (req, res) => {
  return res.status(400).json({
    success: false,
    message: 'Use POST /api/v1/government-blockchain/payments-digital-stamps/issue with residentId and serviceId'
  });
});

module.exports = router;
