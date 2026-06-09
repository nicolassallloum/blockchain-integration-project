'use strict';

const express = require("express");
const couchdbRoutes = require('./couchdb.routes');
const router = express.Router();
const residentRoutes = require('./resident.routes');
// const publicAdministrationRoutes = require('./publicAdministration.routes');
function safeLoadRoute(routeName, routePath) {
  try {
    const route = require(routePath);
    console.log(`[ROUTES] ${routeName} route loaded`);
    return route;
  } catch (error) {
    console.warn(`[ROUTES] ${routeName} route not loaded: ${error.message}`);
    return null;
  }
}



const walletRoutes = require('./wallet.routes');
const transactionRoutes = require('./transaction.routes');
const fabricRoutes = require('./fabric.routes');
const referenceRoutes = require('./reference.routes');
const dashboardRoutes = safeLoadRoute("dashboard", "./dashboard.routes");
const publicAdministrationRoutes = require('./publicAdministration.routes');
const governmentTransactionsRoutes = require('./government-transactions.routes');

// router.use('/government-blockchain/public-administrations', publicAdministrationRoutes);
const governmentReferenceRoutes = require('./government-blockchain/reference.routes');
const residentReferenceRoutes = require('./resident-reference.routes');
const healthRoutes = safeLoadRoute("health", "./health.routes");
const blockchainRoutes = safeLoadRoute("blockchain", "./blockchain.routes");
// const referenceRoutes = require('./reference.routes');
// const residentRoutes = require('./resident.routes');

// const fabricRoutes = safeLoadRoute("fabric", "./fabric.routes");
// const walletRoutes = safeLoadRoute("wallet", "./wallet.routes");
// const transactionRoutes = safeLoadRoute("transaction", "./transaction.routes");

if (healthRoutes) {
  router.use("/health", healthRoutes);
}

if (governmentReferenceRoutes) {
  router.use("/government-blockchain/references", governmentReferenceRoutes);
}
if (blockchainRoutes) {
  router.use("/blockchain", blockchainRoutes);
}

if (residentRoutes) {
  router.use("/government-blockchain/residents", residentRoutes);
}

// if (referenceRoutes) {
//   router.use("/government-blockchain/reference", referenceRoutes);
// }
if (fabricRoutes) {
  router.use("/fabric", fabricRoutes);
}




if (governmentTransactionsRoutes) {
router.use(
  '/government-blockchain/government-transactions',
  governmentTransactionsRoutes
);
}


if (publicAdministrationRoutes) {
  router.use('/government-blockchain/public-administrations', publicAdministrationRoutes);
}
if (walletRoutes) {
  router.use("/wallets", walletRoutes);
}
// if (publicAdministrationRoutes) {
//   router.use('/government-blockchain/public-administrations', publicAdministrationRoutes);
// }
if (transactionRoutes) {
  router.use("/transactions", transactionRoutes);
}
if (couchdbRoutes) {
  router.use("/couchdb", couchdbRoutes);
}
// if (residentRoutes) {
//   router.use("/government-blockchain/residents", residentRoutes);
// }
// router.use('/government-blockchain/residents', residentRoutes);
if (referenceRoutes) {
  router.use("/reference", referenceRoutes);
}

if (dashboardRoutes) {
  router.use("/dashboard", dashboardRoutes);
}

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Blockchain API Middleware is running',
    timestamp: new Date().toISOString()
  });
});
router.use('/government-blockchain/resident-reference', residentReferenceRoutes);


/*
|--------------------------------------------------------------------------
| Account Transactions
|--------------------------------------------------------------------------
| Used by Government Blockchain Account Login screen after successful login.
| GET /api/v1/government-blockchain/accounts/:accountId/transactions
|
| SAFE VERSION:
| Uses to_jsonb(gt)->>'column_name' so the query does not fail if optional
| columns do not exist in blockchain.government_transactions.
*/
router.get('/government-blockchain/accounts/:accountId/transactions', async (req, res) => {
  try {
    const pool = require('../config/database');
    const { accountId } = req.params;

    const result = await pool.query(
      `
      WITH tx AS (
        SELECT
          gt.created_at,
          to_jsonb(gt) AS j
        FROM blockchain.government_transactions gt
      )
      SELECT
        COALESCE(
          j->>'transaction_reference',
          j->>'transaction_id',
          j->>'client_transaction_id',
          ''
        ) AS "transactionId",

        COALESCE(
          j->>'transaction_type',
          'GOVERNMENT_SERVICE'
        ) AS "type",

        COALESCE(
          j->>'from_wallet_address',
          j->>'from_wallet',
          j->>'payer_wallet_address',
          ''
        ) AS "fromWallet",

        COALESCE(
          j->>'to_wallet_address',
          j->>'to_wallet',
          j->>'receiver_wallet_address',
          ''
        ) AS "toWallet",

        COALESCE(
          j->>'amount',
          j->>'fee_amount',
          j->>'total_amount',
          j->>'total_fee',
          '0'
        ) AS "amount",

        COALESCE(
          j->>'currency_code',
          j->>'currency',
          'GOV'
        ) AS "currency",

        COALESCE(
          j->>'transaction_status',
          j->>'status',
          'PENDING'
        ) AS "status",

        COALESCE(
          j->>'service_name',
          j->>'service_code',
          j->>'service_public_id',
          ''
        ) AS "service",

        COALESCE(
          j->>'blockchain_tx_id',
          j->>'fabric_tx_id',
          j->>'tx_id',
          ''
        ) AS "blockchainTx",

        created_at AS "createdAt"
      FROM tx
      WHERE
        COALESCE(j->>'created_by_account_id', '') = $1
        OR COALESCE(j->>'created_by_wallet_address', '') = $1
        OR COALESCE(j->>'administration_id', '') = $1
        OR COALESCE(j->>'ministry_id', '') = $1
        OR COALESCE(j->>'resident_id', '') = $1
        OR COALESCE(j->>'from_wallet_address', '') = $1
        OR COALESCE(j->>'to_wallet_address', '') = $1
        OR COALESCE(j->>'payer_wallet_address', '') = $1
        OR COALESCE(j->>'receiver_wallet_address', '') = $1
      ORDER BY created_at DESC NULLS LAST
      LIMIT 100
      `,
      [accountId]
    );

    return res.status(200).json({
      success: true,
      message: 'Account transactions loaded successfully.',
      data: result.rows
    });
  } catch (error) {
    console.error('[ACCOUNT_TRANSACTIONS_ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load account transactions.',
      error: error.message
    });
  }
});

module.exports = router;
