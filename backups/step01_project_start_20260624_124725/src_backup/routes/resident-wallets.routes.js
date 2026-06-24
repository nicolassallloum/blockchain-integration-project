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
  if (value === 'pending') return 'Pending';
  if (value === 'not created') return 'Not Created';

  return 'Pending';
}

function normalizeBlockchainStatus(status) {
  const value = String(status || '').trim().toLowerCase();

  if (
    value === 'synced' ||
    value === 'confirmed' ||
    value === 'fabric_confirmed' ||
    value === 'success' ||
    value === 'completed'
  ) {
    return 'Synced';
  }

  if (
    value === 'failed' ||
    value === 'error' ||
    value === 'rejected'
  ) {
    return 'Failed';
  }

  return 'Pending';
}

function buildWalletFilterValues(query) {
  return [
    normalizeEmpty(query.walletAddress),
    normalizeEmpty(query.residentId),
    normalizeEmpty(query.residentName),
    normalizeEmpty(query.walletStatus),
    normalizeEmpty(query.blockchainStatus),
  ];
}

function buildResidentWalletBaseSql() {
  return `
    WITH resident_wallet_data AS (
      SELECT
          rw.id,
          rw.wallet_address,
          rw.resident_id,
          COALESCE(
              NULLIF(TRIM(r.full_name), ''),
              TRIM(CONCAT_WS(' ', r.first_name, r.father_name, r.last_name)),
              '-'
          ) AS resident_name,
          COALESCE(NULLIF(TRIM(rw.wallet_currency), ''), 'GOV') AS currency,
          COALESCE(w.current_balance, 0) AS balance,
          COALESCE(NULLIF(TRIM(rw.wallet_status), ''), 'Pending') AS wallet_status,
          COALESCE(NULLIF(TRIM(rw.blockchain_status), ''), 'PENDING') AS blockchain_status,
          rw.fabric_tx_id,
          rw.created_at
      FROM blockchain.resident_wallets rw
      LEFT JOIN blockchain.residents r
          ON r.resident_id = rw.resident_id
      LEFT JOIN blockchain.wallets w
          ON (
              w.wallet_address = rw.wallet_address
              OR w.customer_id = rw.resident_id
          )
      WHERE 1 = 1
        AND (
              $1::text IS NULL
              OR UPPER(COALESCE(rw.wallet_address, '')) LIKE UPPER('%' || $1 || '%')
            )
        AND (
              $2::text IS NULL
              OR UPPER(COALESCE(rw.resident_id, '')) LIKE UPPER('%' || $2 || '%')
            )
        AND (
              $3::text IS NULL
              OR UPPER(
                  COALESCE(
                      NULLIF(TRIM(r.full_name), ''),
                      TRIM(CONCAT_WS(' ', r.first_name, r.father_name, r.last_name)),
                      ''
                  )
              ) LIKE UPPER('%' || $3 || '%')
            )
        AND (
              $4::text IS NULL
              OR UPPER(COALESCE(rw.wallet_status, 'Pending')) = UPPER($4)
            )
        AND (
              $5::text IS NULL
              OR UPPER(COALESCE(rw.blockchain_status, 'PENDING')) = UPPER($5)
              OR (
                  UPPER($5) = 'SYNCED'
                  AND UPPER(COALESCE(rw.blockchain_status, '')) IN ('CONFIRMED', 'FABRIC_CONFIRMED', 'SUCCESS', 'COMPLETED')
              )
            )
    )
  `;
}

function mapWalletRow(row) {
  const walletStatus = normalizeWalletStatus(row.wallet_status);
  const blockchainStatus = normalizeBlockchainStatus(row.blockchain_status);

  return {
    id: row.id,
    walletAddress: row.wallet_address || '-',
    wallet_address: row.wallet_address || '-',

    residentId: row.resident_id || '-',
    resident_id: row.resident_id || '-',

    residentName: row.resident_name || '-',
    resident_name: row.resident_name || '-',

    balance: Number(row.balance || 0),
    currentBalance: Number(row.balance || 0),
    current_balance: Number(row.balance || 0),

    currency: 'GOV',
    walletCurrency: 'GOV',
    wallet_currency: 'GOV',

    walletStatus,
    wallet_status: walletStatus,

    blockchainStatus,
    blockchain_status: blockchainStatus,

    fabricTxId: row.fabric_tx_id || null,
    fabric_tx_id: row.fabric_tx_id || null,

    createdAt: row.created_at,
    created_at: row.created_at,
  };
}

function calculateSummary(wallets) {
  return {
    totalWallets: wallets.length,
    activeWallets: wallets.filter((wallet) => wallet.walletStatus === 'Active').length,
    suspendedWallets: wallets.filter((wallet) => wallet.walletStatus === 'Suspended').length,
    blockedWallets: wallets.filter((wallet) => wallet.walletStatus === 'Blocked').length,
    blockchainSynced: wallets.filter((wallet) => wallet.blockchainStatus === 'Synced').length,
  };
}

async function getResidentWalletRows(filters) {
  const sql = `
    ${buildResidentWalletBaseSql()}
    SELECT
        id,
        wallet_address,
        resident_id,
        resident_name,
        currency,
        balance,
        wallet_status,
        blockchain_status,
        fabric_tx_id,
        created_at
    FROM resident_wallet_data
    ORDER BY created_at DESC NULLS LAST, id DESC
  `;

  const result = await pool.query(sql, filters);
  return result.rows.map(mapWalletRow);
}

router.get('/resident-wallets/summary', async (req, res) => {
  try {
    const filters = buildWalletFilterValues(req.query);
    const wallets = await getResidentWalletRows(filters);
    const summary = calculateSummary(wallets);

    return res.status(200).json({
      success: true,
      message: 'Resident wallet summary loaded successfully.',
      summary,
    });
  } catch (error) {
    console.error('[RESIDENT WALLETS SUMMARY ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load resident wallet summary from PostgreSQL.',
      error: error.message,
      summary: {
        totalWallets: 0,
        activeWallets: 0,
        suspendedWallets: 0,
        blockedWallets: 0,
        blockchainSynced: 0,
      },
    });
  }
});

router.get('/resident-wallets', async (req, res) => {
  try {
    const filters = buildWalletFilterValues(req.query);
    const wallets = await getResidentWalletRows(filters);
    const summary = calculateSummary(wallets);

    return res.status(200).json({
      success: true,
      message: 'Resident wallets loaded successfully from PostgreSQL.',
      summary,
      count: wallets.length,
      data: wallets,
    });
  } catch (error) {
    console.error('[RESIDENT WALLETS ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load resident wallets from PostgreSQL.',
      error: error.message,
      summary: {
        totalWallets: 0,
        activeWallets: 0,
        suspendedWallets: 0,
        blockedWallets: 0,
        blockchainSynced: 0,
      },
      count: 0,
      data: [],
    });
  }
});

module.exports = router;
