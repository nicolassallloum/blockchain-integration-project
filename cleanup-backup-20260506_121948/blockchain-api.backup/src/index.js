const express = require("express");

const healthRoutes = require("./health.routes");
const blockchainRoutes = require("./blockchain.routes");
const fabricRoutes = require("./fabric.routes");
const walletRoutes = require("./wallet.routes");
const transactionRoutes = require("./transaction.routes");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/blockchain", blockchainRoutes);
router.use("/fabric", fabricRoutes);
router.use("/wallets", walletRoutes);
router.use("/transactions", transactionRoutes);

module.exports = router;
