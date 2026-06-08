const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * GET /api/v1/government-blockchain/payments-digital-stamps
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
 */
router.get('/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::BIGINT AS total_payments,
        COALESCE(SUM(amount), 0)::NUMERIC AS total_amount,
        COUNT(CASE WHEN stamp_status IN ('Issued', 'Redeemed') THEN 1 END)::BIGINT AS digital_stamps,
        COUNT(CASE WHEN stamp_status = 'Redeemed' THEN 1 END)::BIGINT AS redeemed
      FROM blockchain.digital_stamp_payments
    `);

    const row = result.rows[0] || {};

    return res.json({
      success: true,
      data: {
        totalPayments: Number(row.total_payments || 0),
        totalAmount: Number(row.total_amount || 0),
        digitalStamps: Number(row.digital_stamps || 0),
        redeemed: Number(row.redeemed || 0)
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
 * POST /api/v1/government-blockchain/payments-digital-stamps
 */
router.post('/', async (req, res) => {
  try {
    const {
      residentName,
      serviceName,
      amount,
      currencyCode = 'LBP',
      paymentStatus = 'Paid',
      stampStatus = 'Issued'
    } = req.body || {};

    if (!residentName || !serviceName || amount === undefined || amount === null || amount === '') {
      return res.status(400).json({
        success: false,
        message: 'residentName, serviceName, and amount are required'
      });
    }

    const cleanAmount = Number(amount);

    if (Number.isNaN(cleanAmount) || cleanAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a valid positive number'
      });
    }

    const now = Date.now();
    const random = Math.floor(100 + Math.random() * 900);

    const paymentRef = `PAY-${String(now).slice(-6)}${random}`;
    const stampId = `DST-${String(now).slice(-6)}${random}`;

    const result = await pool.query(
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
        paymentRef,
        residentName,
        serviceName,
        stampId,
        cleanAmount,
        currencyCode,
        paymentStatus,
        stampStatus
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Digital stamp issued successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[DIGITAL STAMP CREATE ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to issue digital stamp',
      error: error.message
    });
  }
});

module.exports = router;
