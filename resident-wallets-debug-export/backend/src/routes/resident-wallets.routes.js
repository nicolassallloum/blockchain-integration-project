const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/resident-wallets', async (req, res) => {
  try {
    const {
      walletAddress,
      residentId,
      residentName,
      walletStatus,
      blockchainStatus
    } = req.query;

    const sql = `
      SELECT
          r.wallet_address,
          r.resident_id,
          COALESCE(
              NULLIF(TRIM(r.full_name), ''),
              TRIM(CONCAT_WS(' ', r.first_name, r.father_name, r.last_name))
          ) AS resident_name,
          COALESCE(r.wallet_currency, 'GOV') AS currency,
          COALESCE(r.monthly_income, 0) AS current_balance,
          COALESCE(r.wallet_status, 'ACTIVE') AS wallet_status,
          COALESCE(r.blockchain_status, 'PENDING') AS blockchain_status,
          r.created_at
      FROM blockchain.residents r
      WHERE 1 = 1
        AND (
              $1::text IS NULL
              OR UPPER(COALESCE(r.wallet_address, '')) LIKE UPPER('%' || $1 || '%')
            )
        AND (
              $2::text IS NULL
              OR UPPER(COALESCE(r.resident_id, '')) LIKE UPPER('%' || $2 || '%')
            )
        AND (
              $3::text IS NULL
              OR UPPER(
                  COALESCE(
                      NULLIF(TRIM(r.full_name), ''),
                      TRIM(CONCAT_WS(' ', r.first_name, r.father_name, r.last_name))
                  )
              ) LIKE UPPER('%' || $3 || '%')
            )
        AND (
              $4::text IS NULL
              OR UPPER(COALESCE(r.wallet_status, 'ACTIVE')) = UPPER($4)
            )
        AND (
              $5::text IS NULL
              OR UPPER(COALESCE(r.blockchain_status, 'PENDING')) = UPPER($5)
            )
      ORDER BY r.created_at DESC NULLS LAST, r.id DESC
    `;

    const values = [
      walletAddress || null,
      residentId || null,
      residentName || null,
      walletStatus || null,
      blockchainStatus || null
    ];

    const result = await pool.query(sql, values);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error('[RESIDENT WALLETS ERROR]', error);

    res.status(500).json({
      success: false,
      message: 'Failed to load resident wallets from database.',
      error: error.message
    });
  }
});

module.exports = router;