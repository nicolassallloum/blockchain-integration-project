const express = require("express");
const router = express.Router();

const walletController = require("../controllers/wallet.controller");

/**
 * POST /api/v1/wallets
 * Create wallet
 */
router.post("/", walletController.createWallet);

module.exports = router;
