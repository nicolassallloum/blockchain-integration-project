"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

const config = require("./config");
const logger = require("./utils/logger");

// Existing routes
const healthRoutes = require("./routes/health.routes");
const blockchainRoutes = require("./routes/blockchain.routes");
const transactionRoutes = require("./transaction.routes");
// STEP 20 — Fabric SDK Integration routes
const fabricRoutes = require("./routes/fabric.routes");

const app = express();

// ==================================================
// API Prefix Fallback
// ==================================================
const API_PREFIX = config.api?.prefix || process.env.API_PREFIX || "/api/v1";
router.use("/transactions", transactionRoutes);
// ==================================================
// Security Middleware
// ==================================================
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// ==================================================
// CORS Middleware
// ==================================================
app.use(
  cors({
    origin: config.cors?.origin || process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id"]
  })
);

// ==================================================
// Body Parser Middleware
// ==================================================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ==================================================
// Compression Middleware
// ==================================================
app.use(compression());

// ==================================================
// Request Logging Middleware
// ==================================================
app.use((req, res, next) => {
  if (logger && typeof logger.info === "function") {
    logger.info(`${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent")
    });
  }

  next();
});

// ==================================================
// Root Route
// ==================================================
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Blockchain API Middleware is running",
    apiPrefix: API_PREFIX,
    health: `${API_PREFIX}/health`,
    blockchainStatus: `${API_PREFIX}/blockchain/status`,
    fabricStatus: `${API_PREFIX}/fabric/status`,
    fabricEvaluate: `${API_PREFIX}/fabric/evaluate`,
    fabricSubmit: `${API_PREFIX}/fabric/submit`,
    timestamp: new Date().toISOString()
  });
});

// ==================================================
// API Routes
// ==================================================
app.use(`${API_PREFIX}/health`, healthRoutes);
app.use(`${API_PREFIX}/blockchain`, blockchainRoutes);

// STEP 20 — Hyperledger Fabric SDK Routes
app.use(`${API_PREFIX}/fabric`, fabricRoutes);

// ==================================================
// 404 Handler
// Important: This must stay AFTER all route registrations
// ==================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    data: null,
    meta: null,
    timestamp: new Date().toISOString()
  });
});

// ==================================================
// Global Error Handler
// ==================================================
app.use((err, req, res, next) => {
  if (logger && typeof logger.error === "function") {
    logger.error("Unhandled application error", {
      message: err.message,
      stack: err.stack,
      method: req.method,
      url: req.originalUrl
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    data: null,
    meta: null,
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
