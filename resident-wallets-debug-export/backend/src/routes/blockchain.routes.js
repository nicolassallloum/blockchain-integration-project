const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const blockchainController = require("../controllers/blockchain.controller");

const router = express.Router();

router.get("/status", asyncHandler(blockchainController.getBlockchainStatus));

/**
 * Future route placeholders:
 *
 * POST   /wallets/create
 * POST   /wallets/login
 * POST   /transactions/wallet-transfer
 * POST   /transactions/organization-transfer
 * GET    /wallets/:walletAddress/balance
 * GET    /wallets/:walletAddress/transactions
 */

module.exports = router;
