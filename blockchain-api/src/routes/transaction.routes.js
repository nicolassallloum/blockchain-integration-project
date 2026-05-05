const express = require("express");

const transactionController = require("../controllers/transaction.controller");

const router = express.Router();

/**
 * STEP 26 — Transaction History & Search APIs
 *
 * GET /api/v1/transactions
 * GET /api/v1/transactions/:transactionId
 */

// Search transaction history
router.get("/", transactionController.searchTransactions);

// Get single transaction by transactionId
router.get("/:transactionId", transactionController.getTransactionById);

module.exports = router;
