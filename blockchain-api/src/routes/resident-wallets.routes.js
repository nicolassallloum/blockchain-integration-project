'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

function normalizeEmpty(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();

  return text === '' ? null : text;
}

function normalizeWalletStatus(status) {
  const value = String(status || '').trim().toLowerCase();

  if (value === 'active') return 'Active';
  if (value === 'suspended') return 'Suspended';
  if (value === 'blocked') return 'Blocked';
  if (value === 'not created') return 'Not Created';

  return 'Pending';
}

function normalizeBlockchainStatus(status) {
  const value = String(status || '').trim().toLowerCase();

  if (value === 'synced') return 'Synced';
  if (value === 'confirmed') return 'Synced';
  if (value === 'sync') return 'Synced';
  if (value === 'success') return 'Synced';
  if (value === 'failed') return 'Failed';
  if (value === 'error') return 'Failed';

  return 'Pending';
}

router.get('/resident-wallets', async (req, res) => {
  try {
    const walletAddress = normalizeEmpty(req.query.walletAddress);
    const residentId = normalizeEmpty(req.query.residentId);
    const residentName = normalizeEmpty(req.query.residentName);
    const walletStatus = normalizeEmpty(req.query.walletStatus);
    const blockchainStatus = normalizeEmpty(req.query.blockchainStatus);

    const sql = `
      SELECT
          r.id,
          COALESCE(NULLIF(TRIM(r.wallet_address), ''), '-') AS wallet_address,
          r.resident_id,
          COALESCE(
              NULLIF(TRIM(r.full_name), ''),
              TRIM(CONCAT_WS(' ', r.first_name, r.father_name, r.last_name))
          ) AS resident_name,
          COALESCE(NULLIF(TRIM(r.wallet_currency), ''), 'LBP') AS currency,
          COALESCE(r.monthly_income, 0) AS current_balance,
          COALESCE(NULLIF(TRIM(r.wallet_status), ''), 'Not Created') AS wallet_status,
          COALESCE(NULLIF(TRIM(r.blockchain_status), ''), 'PENDING') AS blockchain_status,
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
              OR UPPER(COALESCE(r.wallet_status, 'Not Created')) = UPPER($4)
            )
        AND (
              $5::text IS NULL
              OR UPPER(COALESCE(r.blockchain_status, 'PENDING')) = UPPER($5)
            )
      ORDER BY r.created_at DESC NULLS LAST, r.id DESC
    `;

    const values = [
      walletAddress,
      residentId,
      residentName,
      walletStatus,
      blockchainStatus
    ];

    const result = await pool.query(sql, values);

    const data = result.rows.map((row) => ({
      id: row.id,
      walletAddress: row.wallet_address,
      wallet_address: row.wallet_address,
      residentId: row.resident_id,
      resident_id: row.resident_id,
      residentName: row.resident_name,
      resident_name: row.resident_name,
      currency: row.currency,
      currentBalance: Number(row.current_balance || 0),
      current_balance: Number(row.current_balance || 0),
      walletStatus: normalizeWalletStatus(row.wallet_status),
      wallet_status: normalizeWalletStatus(row.wallet_status),
      blockchainStatus: normalizeBlockchainStatus(row.blockchain_status),
      blockchain_status: normalizeBlockchainStatus(row.blockchain_status),
      createdAt: row.created_at,
      created_at: row.created_at
    }));

    const summary = {
      totalWallets: data.length,
      activeWallets: data.filter((wallet) => wallet.walletStatus === 'Active').length,
      suspendedWallets: data.filter((wallet) => wallet.walletStatus === 'Suspended').length,
      blockedWallets: data.filter((wallet) => wallet.walletStatus === 'Blocked').length,
      blockchainSynced: data.filter((wallet) => wallet.blockchainStatus === 'Synced').length
    };

    return res.status(200).json({
      success: true,
      message: 'Resident wallets loaded successfully.',
      summary,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('[RESIDENT WALLETS ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load resident wallets from database.',
      error: error.message,
      data: [],
      summary: {
        totalWallets: 0,
        activeWallets: 0,
        suspendedWallets: 0,
        blockedWallets: 0,
        blockchainSynced: 0
      }
    });
  }
});

module.exports = router;
