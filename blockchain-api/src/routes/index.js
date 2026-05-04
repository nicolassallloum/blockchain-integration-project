const express = require("express");

const router = express.Router();

/**
 * Route imports
 *
 * Keep every route file optional-safe so the API does not crash
 * if one route file is not yet created during development.
 */

function safeRequire(path, routeName) {
  try {
    return require(path);
  } catch (error) {
    console.warn(`[ROUTES] ${routeName} route not loaded: ${error.message}`);
    return null;
  }
}

const healthRoutes = safeRequire("./health.routes", "health");
const blockchainRoutes = safeRequire("./blockchain.routes", "blockchain");
const fabricRoutes = safeRequire("./fabric.routes", "fabric");
const walletRoutes = safeRequire("./wallet.routes", "wallet");

/**
 * API Routes
 *
 * These paths are mounted under /api/v1 from server.js
 *
 * Final URLs:
 * GET  /api/v1/health
 * GET  /api/v1/blockchain/status
 * POST /api/v1/fabric/submit
 * POST /api/v1/wallets
 */

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

/**
 * API root endpoint
 */
router.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Blockchain API v1 is running",
    data: {
      availableRoutes: {
        health: "/api/v1/health",
        blockchainStatus: "/api/v1/blockchain/status",
        fabricSubmit: "/api/v1/fabric/submit",
        walletCreation: "/api/v1/wallets"
      }
    },
    meta: null,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
