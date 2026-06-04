const express = require("express");

const transactionController = require("../controllers/transaction.controller");

const router = express.Router();

/**
 * STEP 26 — Transaction History & Search APIs
 *
 * Base path from server.js:
 * /api/v1/transactions
 *
 * Final endpoints:
 * GET /api/v1/transactions
 * GET /api/v1/transactions/:transactionId
 */

// Search transaction history
router.get("/", transactionController.searchTransactions);

// Get transaction by transactionId
router.get("/:transactionId", transactionController.getTransactionById);

module.exports = router;