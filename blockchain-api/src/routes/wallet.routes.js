const express = require("express");

const router = express.Router();

let walletController = null;

try {
  walletController = require("../controllers/wallet.controller");
} catch (error) {
  console.warn("[ROUTES] wallet controller not loaded:", error.message);
}

/**
 * Wallet Creation
 * POST /api/v1/wallets
 */
if (walletController && walletController.createWallet) {
  router.post("/", walletController.createWallet);
}

/**
 * Wallet Login
 * POST /api/v1/wallets/login
 */
if (walletController && walletController.loginWallet) {
  router.post("/login", walletController.loginWallet);
}

module.exports = router;
