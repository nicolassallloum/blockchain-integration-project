'use strict';

const express = require("express");

const router = express.Router();

function safeLoadRoute(routeName, routePath) {
  try {
    const route = require(routePath);
    console.log(`[ROUTES] ${routeName} route loaded`);
    return route;
  } catch (error) {
    console.warn(`[ROUTES] ${routeName} route not loaded: ${error.message}`);
    return null;
  }
}



const walletRoutes = require('./wallet.routes');
const transactionRoutes = require('./transaction.routes');
const fabricRoutes = require('./fabric.routes');


const healthRoutes = safeLoadRoute("health", "./health.routes");
const blockchainRoutes = safeLoadRoute("blockchain", "./blockchain.routes");
// const fabricRoutes = safeLoadRoute("fabric", "./fabric.routes");
// const walletRoutes = safeLoadRoute("wallet", "./wallet.routes");
// const transactionRoutes = safeLoadRoute("transaction", "./transaction.routes");

if (healthRoutes) {
  router.use("/health", healthRoutes);
}

if (blockchainRoutes) {
  router.use("/blockchain", blockchainRoutes);
}

if (fabricRoutes) {
  router.use("/fabric", fabricRoutes);
}

if (walletRoutes) {
  router.use("/wallets", walletRoutes);
}

if (transactionRoutes) {
  router.use("/transactions", transactionRoutes);
}

module.exports = router;
