'use strict';

/**
 * STEP 59 — Digital KYC Dashboard Enhancement Service
 *
 * Provides one optimized dashboard response for:
 * - Total Balance
 * - Today Created Wallets
 * - Today Transactions
 * - Total Transactions
 * - Wallet Growth Chart
 * - Transactions Overview
 * - Organization / Bank Summary
 * - Blockchain Network Health
 * - Latest Transactions
 */

const db = require('../config/database');

function toNumber(value, defaultValue = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function firstRow(result, fallback = {}) {
  return result && Array.isArray(result.rows) && result.rows.length > 0
    ? result.rows[0]
    : fallback;
}

function mapStatus(value) {
  if (!value) {
    return 'UNKNOWN';
  }

  return String(value).toUpperCase();
}

async function getWalletSummary() {
  const result = await db.query(`
    SELECT
      COUNT(*)::bigint AS total_wallets,
      COUNT(*) FILTER (WHERE UPPER(COALESCE(status, wallet_status, login_status, '')) = 'ACTIVE')::bigint AS active_wallets,
      COALESCE(SUM(current_balance) FILTER (WHERE UPPER(COALESCE(status, wallet_status, login_status, '')) = 'ACTIVE'), 0)::numeric AS total_balance,
      COUNT(*) FILTER (
        WHERE created_at >= CURRENT_DATE
          AND created_at < CURRENT_DATE + INTERVAL '1 day'
      )::bigint AS today_created_wallets
    FROM blockchain.wallets
  `);

  const row = firstRow(result);

  return {
    totalWallets: toNumber(row.total_wallets),
    activeWallets: toNumber(row.active_wallets),
    totalBalance: toNumber(row.total_balance),
    todayCreatedWallets: toNumber(row.today_created_wallets),
    currencyCode: 'USD'
  };
}

async function getTransactionSummary() {
  const result = await db.query(`
    SELECT
      COUNT(*)::bigint AS total_transactions,
      COUNT(*) FILTER (
        WHERE created_at >= CURRENT_DATE
          AND created_at < CURRENT_DATE + INTERVAL '1 day'
      )::bigint AS today_transactions,
      COUNT(*) FILTER (
        WHERE UPPER(COALESCE(transaction_type, '')) IN (
          'TRANSFER',
          'WALLET_TRANSFER',
          'WALLET_TO_WALLET',
          'CUSTOMER_TRANSFER'
        )
      )::bigint AS wallet_to_wallet_transfers,
      COUNT(*) FILTER (
        WHERE UPPER(COALESCE(transaction_type, '')) IN (
          'ORGANIZATION_TRANSFER',
          'WALLET_TO_ORGANIZATION',
          'WALLET_ORGANIZATION_TRANSFER',
          'ORG_TRANSFER'
        )
        OR (
          organization_code IS NOT NULL
          AND NULLIF(TRIM(organization_code), '') IS NOT NULL
        )
      )::bigint AS wallet_to_organization_transfers,
      COALESCE(SUM(amount), 0)::numeric AS total_transaction_volume,
      COALESCE(AVG(amount), 0)::numeric AS average_transaction_amount,
      COUNT(*) FILTER (
        WHERE UPPER(COALESCE(status, transaction_status, fabric_status, '')) IN ('FAILED', 'ERROR', 'REJECTED')
      )::bigint AS failed_transactions,
      COUNT(*) FILTER (
        WHERE UPPER(COALESCE(status, transaction_status, fabric_status, '')) IN ('PENDING', 'SUBMITTED', 'PROCESSING')
      )::bigint AS pending_transactions
    FROM blockchain.transactions
  `);

  const row = firstRow(result);

  return {
    todayTransactions: toNumber(row.today_transactions),
    totalTransactions: toNumber(row.total_transactions),
    walletToWalletTransfers: toNumber(row.wallet_to_wallet_transfers),
    walletToOrganizationTransfers: toNumber(row.wallet_to_organization_transfers),
    totalTransactionVolume: toNumber(row.total_transaction_volume),
    averageTransactionAmount: toNumber(row.average_transaction_amount),
    failedTransactions: toNumber(row.failed_transactions),
    pendingTransactions: toNumber(row.pending_transactions),
    currencyCode: 'USD'
  };
}

async function getWalletGrowth() {
  const result = await db.query(`
    SELECT
      TO_CHAR(day_bucket, 'YYYY-MM-DD') AS date,
      wallets::bigint AS wallets
    FROM (
      SELECT
        DATE(created_at) AS day_bucket,
        COUNT(*) AS wallets
      FROM blockchain.wallets
      WHERE created_at >= CURRENT_DATE - INTERVAL '29 days'
      GROUP BY DATE(created_at)
    ) daily
    ORDER BY day_bucket ASC
  `);

  return result.rows.map((row) => ({
    date: row.date,
    wallets: toNumber(row.wallets)
  }));
}

async function getOrganizationSummary() {
  const result = await db.query(`
    WITH wallet_summary AS (
      SELECT
        organization_code,
        COUNT(*)::bigint AS wallets,
        COALESCE(SUM(current_balance), 0)::numeric AS balance
      FROM blockchain.wallets
      WHERE organization_code IS NOT NULL
        AND NULLIF(TRIM(organization_code), '') IS NOT NULL
      GROUP BY organization_code
    ),
    transaction_summary AS (
      SELECT
        organization_code,
        COUNT(*)::bigint AS transactions
      FROM blockchain.transactions
      WHERE organization_code IS NOT NULL
        AND NULLIF(TRIM(organization_code), '') IS NOT NULL
      GROUP BY organization_code
    )
    SELECT
      o.organization_code,
      o.organization_name,
      o.organization_type,
      COALESCE(ws.wallets, 0)::bigint AS wallets,
      COALESCE(ws.balance, 0)::numeric AS balance,
      COALESCE(ts.transactions, 0)::bigint AS transactions,
      o.status
    FROM blockchain.organizations o
    LEFT JOIN wallet_summary ws
      ON ws.organization_code = o.organization_code
    LEFT JOIN transaction_summary ts
      ON ts.organization_code = o.organization_code
    ORDER BY COALESCE(ws.wallets, 0) DESC, o.organization_name ASC
    LIMIT 10
  `);

  return result.rows.map((row) => ({
    organizationCode: row.organization_code,
    organizationName: row.organization_name,
    organizationType: row.organization_type,
    wallets: toNumber(row.wallets),
    balance: toNumber(row.balance),
    transactions: toNumber(row.transactions),
    status: mapStatus(row.status)
  }));
}

async function getBlockchainHealth() {
  const result = await db.query(`
    SELECT
      COALESCE(MAX(fabric_block_number), 0)::bigint AS last_block_number,
      GREATEST(
        COALESCE((SELECT MAX(updated_at) FROM blockchain.wallets), TIMESTAMPTZ '1970-01-01'),
        COALESCE((SELECT MAX(updated_at) FROM blockchain.transactions), TIMESTAMPTZ '1970-01-01')
      ) AS last_sync_time
    FROM blockchain.transactions
  `);

  const row = firstRow(result);

  return {
    fabricPeerStatus: process.env.FABRIC_PEER_STATUS || 'Online',
    ordererStatus: process.env.FABRIC_ORDERER_STATUS || 'Online',
    couchDbStatus: process.env.COUCHDB_STATUS || 'Online',
    postgresqlStatus: 'Online',
    chaincodeStatus: process.env.FABRIC_CHAINCODE_STATUS || 'Committed',
    channelName: process.env.FABRIC_CHANNEL_NAME || process.env.CHANNEL_NAME || 'kycchannelnix1',
    chaincodeVersion: process.env.FABRIC_CHAINCODE_VERSION || process.env.CHAINCODE_VERSION || '2.x',
    chaincodeName: process.env.FABRIC_CHAINCODE_NAME || process.env.CHAINCODE_NAME || 'kyc-wallet-chaincode-js',
    lastBlockNumber: toNumber(row.last_block_number),
    lastSyncTime: row.last_sync_time || null
  };
}

async function getLatestTransactions(limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

  const result = await db.query(`
    SELECT
      transaction_id,
      COALESCE(
        NULLIF(fabric_transaction_id, ''),
        NULLIF(fabric_tx_id, ''),
        NULLIF(ledger_transaction_id, ''),
        transaction_id::text
      ) AS tx_id,
      COALESCE(NULLIF(sender_wallet_address, ''), NULLIF(from_wallet_address, ''), '-') AS from_wallet,
      COALESCE(NULLIF(receiver_wallet_address, ''), NULLIF(to_wallet_address, ''), NULLIF(organization_code, ''), '-') AS to_wallet,
      transaction_type,
      amount,
      COALESCE(NULLIF(currency_code, ''), NULLIF(currency, ''), 'USD') AS currency,
      COALESCE(NULLIF(status, ''), NULLIF(transaction_status, ''), NULLIF(fabric_status, ''), 'UNKNOWN') AS status,
      created_at
    FROM blockchain.transactions
    ORDER BY created_at DESC
    LIMIT $1
  `, [safeLimit]);

  return result.rows.map((row) => ({
    transactionId: row.transaction_id,
    txId: row.tx_id,
    from: row.from_wallet,
    to: row.to_wallet,
    type: row.transaction_type,
    amount: toNumber(row.amount),
    currency: row.currency || 'USD',
    status: mapStatus(row.status),
    date: row.created_at
  }));
}

async function getDashboardSummary() {
  const [
    walletSummary,
    transactionSummary,
    walletGrowth,
    organizationSummary,
    blockchainHealth,
    latestTransactions
  ] = await Promise.all([
    getWalletSummary(),
    getTransactionSummary(),
    getWalletGrowth(),
    getOrganizationSummary(),
    getBlockchainHealth(),
    getLatestTransactions(20)
  ]);

  return {
    walletSummary,
    transactionSummary,
    walletGrowth,
    organizationSummary,
    blockchainHealth,
    latestTransactions
  };
}

module.exports = {
  getWalletSummary,
  getTransactionSummary,
  getWalletGrowth,
  getOrganizationSummary,
  getBlockchainHealth,
  getLatestTransactions,
  getDashboardSummary
};
