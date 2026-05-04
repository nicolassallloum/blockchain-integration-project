const express = require("express");

const router = express.Router();

const walletController = require("../controllers/wallet.controller");
const walletAuthController = require("../controllers/wallet-auth.controller");

const {
  validateWalletLoginRequest
} = require("../middlewares/wallet-login.validator");

// Existing wallet creation endpoint from Step 21
router.post("/", walletController.createWallet);

// STEP 22 — Wallet Login API
router.post(
  "/login",
  validateWalletLoginRequest,
  walletAuthController.loginWallet
);

module.exports = router;
