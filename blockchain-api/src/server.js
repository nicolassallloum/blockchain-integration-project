"use strict";

/**
 * Blockchain API Middleware Server
 * STEP 27 — Updated Authentication & Authorization Integration
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");

let logger;

try {
  logger = require("./utils/logger");
} catch (error) {
  logger = console;
}

/**
 * Routes
 */
const apiRoutes = require("./routes");
const authRoutes = require("./routes/auth.routes");

/**
 * STEP 27 Error Middleware
 */
const {
  errorHandler,
  notFoundHandler
} = require("./middleware/error.middleware");

const app = express();

/**
 * Environment configuration
 */
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";
const API_PREFIX = process.env.API_PREFIX || "/api/v1";
const SERVICE_NAME = process.env.SERVICE_NAME || "Blockchain API Middleware";
const SERVICE_VERSION = process.env.SERVICE_VERSION || "1.0.0";

/**
 * Security headers
 */
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "same-origin"
    }
  })
);

/**
 * CORS
 */
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "X-Request-ID",
      "x-request-id",
      "x-api-key"
    ],
    exposedHeaders: ["x-request-id"]
  })
);

/**
 * Body parsers
 */
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "10mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.URLENCODED_BODY_LIMIT || "10mb"
  })
);

/**
 * Compression
 */
app.use(compression());

/**
 * Request ID propagation
 */
app.use((req, res, next) => {
  const incomingRequestId =
    req.headers["x-request-id"] ||
    req.headers["X-Request-ID"];

  req.requestId =
    incomingRequestId ||
    `REQ_${Date.now()}_${Math.random().toString(16).slice(2).toUpperCase()}`;

  res.setHeader("x-request-id", req.requestId);

  next();
});

/**
 * HTTP request logging
 */
app.use(
  morgan("combined", {
    stream: {
      write: (message) => {
        if (logger && logger.info) {
          logger.info(message.trim());
        } else {
          console.log(message.trim());
        }
      }
    }
  })
);

/**
 * Simple structured request log
 */
app.use((req, res, next) => {
  if (logger && logger.info) {
    logger.info(`${req.method} ${req.originalUrl}`, {
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });
  } else {
    console.log(`${req.method} ${req.originalUrl}`);
  }

  next();
});

/**
 * Root endpoint
 */
app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: `${SERVICE_NAME} is running`,
    apiPrefix: API_PREFIX,
    health: `${API_PREFIX}/health`,
    auth: `${API_PREFIX}/auth`,
    blockchainStatus: `${API_PREFIX}/blockchain/status`,
    fabricSubmit: `${API_PREFIX}/fabric/submit`,
    walletCreation: `${API_PREFIX}/wallets`,
    transactionHistory: `${API_PREFIX}/transactions`,
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

/**
 * Health endpoint
 */
app.get(`${API_PREFIX}/health`, (req, res) => {
  return res.status(200).json({
    success: true,
    message: `${SERVICE_NAME} is healthy`,
    data: {
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: NODE_ENV,
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
      system: {
        hostname: require("os").hostname(),
        platform: process.platform,
        memoryFree: require("os").freemem(),
        memoryTotal: require("os").totalmem()
      },
      blockchain: {
        channelName: process.env.FABRIC_CHANNEL_NAME || process.env.CHANNEL_NAME || null,
        chaincodeName: process.env.FABRIC_CHAINCODE_NAME || process.env.CHAINCODE_NAME || null,
        mspId: process.env.FABRIC_MSP_ID || process.env.MSP_ID || null
      }
    },
    meta: null,
    requestId: req.requestId
  });
});

/**
 * STEP 27 Auth routes
 *
 * Final endpoints:
 * POST /api/v1/auth/login
 * POST /api/v1/auth/system-token
 * GET  /api/v1/auth/me
 */
app.use(`${API_PREFIX}/auth`, authRoutes);

/**
 * Existing API routes
 *
 * Keep this as the single main route registration point.
 * Do NOT additionally mount duplicate wallet/transaction/fabric routes here
 * unless they are not included in src/routes/index.js.
 */
app.use(API_PREFIX, apiRoutes);

/**
 * 404 handler
 */
if (typeof notFoundHandler === "function") {
  app.use(notFoundHandler);
} else {
  app.use((req, res) => {
    return res.status(404).json({
      success: false,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      errorCode: "ROUTE_NOT_FOUND",
      data: null,
      meta: null,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  });
}

/**
 * Global error handler
 */
if (typeof errorHandler === "function") {
  app.use(errorHandler);
} else {
  app.use((error, req, res, next) => {
    const statusCode = error.statusCode || error.status || 500;

    if (logger && logger.error) {
      logger.error("Unhandled API error", {
        message: error.message,
        stack: error.stack,
        method: req.method,
        url: req.originalUrl,
        requestId: req.requestId
      });
    } else {
      console.error("Unhandled API error:", error);
    }

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Internal server error",
      errorCode: error.errorCode || error.code || "INTERNAL_SERVER_ERROR",
      data: null,
      meta: null,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  });
}

/**
 * Start server
 */
const server = app.listen(PORT, HOST, () => {
  const startMessages = [
    "==================================================",
    `${SERVICE_NAME} started successfully`,
    `Environment: ${NODE_ENV}`,
    `Version: ${SERVICE_VERSION}`,
    `URL: http://${HOST}:${PORT}`,
    `Health Check: http://${HOST}:${PORT}${API_PREFIX}/health`,
    `Auth: http://${HOST}:${PORT}${API_PREFIX}/auth`,
    `Wallets: http://${HOST}:${PORT}${API_PREFIX}/wallets`,
    `Transactions: http://${HOST}:${PORT}${API_PREFIX}/transactions`,
    "=================================================="
  ];

  startMessages.forEach((message) => {
    if (logger && logger.info) {
      logger.info(message);
    } else {
      console.log(message);
    }
  });
});

/**
 * Graceful shutdown
 */
function shutdown(signal) {
  const message = `Received ${signal}. Shutting down ${SERVICE_NAME}...`;

  if (logger && logger.info) {
    logger.info(message);
  } else {
    console.log(message);
  }

  server.close(() => {
    if (logger && logger.info) {
      logger.info("HTTP server closed successfully");
    } else {
      console.log("HTTP server closed successfully");
    }

    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

/**
 * Uncaught exception handler
 */
process.on("uncaughtException", (error) => {
  if (logger && logger.error) {
    logger.error(`Uncaught Exception ${error.message}`, {
      stack: error.stack,
      service: SERVICE_NAME,
      environment: NODE_ENV
    });
  } else {
    console.error("Uncaught Exception:", error);
  }

  process.exit(1);
});

/**
 * Unhandled promise rejection handler
 */
process.on("unhandledRejection", (reason) => {
  if (logger && logger.error) {
    logger.error("Unhandled Rejection", {
      reason,
      service: SERVICE_NAME,
      environment: NODE_ENV
    });
  } else {
    console.error("Unhandled Rejection:", reason);
  }

  process.exit(1);
});

module.exports = app;