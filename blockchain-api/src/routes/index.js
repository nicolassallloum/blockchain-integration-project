const express = require("express");

const healthRoutes = require("./health.routes");
const blockchainRoutes = require("./blockchain.routes");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/blockchain", blockchainRoutes);

module.exports = router;
