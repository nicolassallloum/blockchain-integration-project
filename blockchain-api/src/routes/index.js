'use strict';

const express = require("express");
const couchdbRoutes = require('./couchdb.routes');
const router = express.Router();
const residentRoutes = require('./resident.routes');
// const publicAdministrationRoutes = require('./publicAdministration.routes');
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
const referenceRoutes = require('./reference.routes');
const dashboardRoutes = safeLoadRoute("dashboard", "./dashboard.routes");
const publicAdministrationRoutes = require('./publicAdministration.routes');
// router.use('/government-blockchain/public-administrations', publicAdministrationRoutes);
const governmentReferenceRoutes = require('./government-blockchain/reference.routes');
const residentReferenceRoutes = require('./resident-reference.routes');
const healthRoutes = safeLoadRoute("health", "./health.routes");
const blockchainRoutes = safeLoadRoute("blockchain", "./blockchain.routes");
// const referenceRoutes = require('./reference.routes');
// const residentRoutes = require('./resident.routes');

// const fabricRoutes = safeLoadRoute("fabric", "./fabric.routes");
// const walletRoutes = safeLoadRoute("wallet", "./wallet.routes");
// const transactionRoutes = safeLoadRoute("transaction", "./transaction.routes");

if (healthRoutes) {
  router.use("/health", healthRoutes);
}

if (governmentReferenceRoutes) {
  router.use("/government-blockchain/references", governmentReferenceRoutes);
}
if (blockchainRoutes) {
  router.use("/blockchain", blockchainRoutes);
}

if (residentRoutes) {
  router.use("/government-blockchain/residents", residentRoutes);
}

// if (referenceRoutes) {
//   router.use("/government-blockchain/reference", referenceRoutes);
// }
if (fabricRoutes) {
  router.use("/fabric", fabricRoutes);
}
if (publicAdministrationRoutes) {
  router.use('/government-blockchain/public-administrations', publicAdministrationRoutes);
}
if (walletRoutes) {
  router.use("/wallets", walletRoutes);
}
// if (publicAdministrationRoutes) {
//   router.use('/government-blockchain/public-administrations', publicAdministrationRoutes);
// }
if (transactionRoutes) {
  router.use("/transactions", transactionRoutes);
}
if (couchdbRoutes) {
  router.use("/couchdb", couchdbRoutes);
}
// if (residentRoutes) {
//   router.use("/government-blockchain/residents", residentRoutes);
// }
// router.use('/government-blockchain/residents', residentRoutes);
if (referenceRoutes) {
  router.use("/reference", referenceRoutes);
}

if (dashboardRoutes) {
  router.use("/dashboard", dashboardRoutes);
}

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Blockchain API Middleware is running',
    timestamp: new Date().toISOString()
  });
});
router.use('/government-blockchain/resident-reference', residentReferenceRoutes);

module.exports = router;
