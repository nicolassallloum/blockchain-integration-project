const express = require("express");
const router = express.Router();

const transactionController = require("../controllers/transaction.controller");

/**
 * STEP 23
 * Wallet-to-wallet transfer
 *
 * POST /api/v1/transactions/wallet-transfer
 */
router.post(
  "/wallet-transfer",
  transactionController.walletToWalletTransfer
);

/**
 * STEP 24
 * Wallet-to-organization transfer
 *
 * POST /api/v1/transactions/organization-transfer
 */
router.post(
  "/organization-transfer",
  transactionController.walletToOrganizationTransfer
);

module.exports = router;
