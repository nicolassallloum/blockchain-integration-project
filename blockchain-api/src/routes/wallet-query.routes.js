const express = require("express");
const router = express.Router();

const walletQueryController = require("../controllers/wallet-query.controller");

/**
 * STEP 25 — Wallet Query APIs
 *
 * GET /api/v1/wallets/:walletAddress
 * GET /api/v1/wallets/:walletAddress/balance
 * GET /api/v1/wallets/:walletAddress/history
 */

router.get("/:walletAddress", walletQueryController.getWalletByAddress);

router.get("/:walletAddress/balance", walletQueryController.getWalletBalance);

router.get("/:walletAddress/history", walletQueryController.getWalletHistory);

module.exports = router;