const express = require("express");

const router = express.Router();

const walletRoutes = require("./wallet.routes");

router.use("/wallets", walletRoutes);

module.exports = router;
