const express = require("express");
const transactionController = require("../controllers/transaction.controller");

const router = express.Router();

/**
 * STEP 23
 * Wallet-to-Wallet Transfer API
 *
 * POST /api/v1/transactions/wallet-transfer
 */
router.post(
  "/wallet-transfer",
  transactionController.walletToWalletTransfer
);

module.exports = router;
