"use strict";

/**
 * Blockchain API Middleware Server
 * STEP 28 — API Security Controls Integrated
 * Keeps STEP 27 Auth + Central Route Registration
 */

require("dotenv").config();

const express = require("express");
const compression = require("compression");
const morgan = require("morgan");
const os = require("os");

const securityConfig = require("./config/security.config");
const { validateEnvironmentSecrets } = require("./config/env.validator");
const { applySecurityMiddleware } = require("./middleware/security.middleware");

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
 * Error Middleware
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
 * STEP 28 — Validate important secrets at startup.
 */
validateEnvironmentSecrets();

/**
 * STEP 28 — Request ID propagation.
 * Must run early so all logs and errors include requestId.
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
 * STEP 28 — Request size limits.
 */
app.use(
  express.json({
    limit:
      securityConfig.requestBodyLimit ||
      process.env.JSON_BODY_LIMIT ||
      "1mb",
    strict: true
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit:
      securityConfig.requestBodyLimit ||
      process.env.URLENCODED_BODY_LIMIT ||
      "1mb"
  })
);

/**
 * STEP 28 — Security controls:
 * Helmet headers, CORS rules, HPP protection,
 * suspicious request logging, SQL injection blocking,
 * global rate limiting.
 */
applySecurityMiddleware(app);

/**
 * Compression
 */
app.use(compression());

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
        hostname: os.hostname(),
        platform: process.platform,
        memoryFree: os.freemem(),
        memoryTotal: os.totalmem()
      },
      security: {
        helmet: true,
        cors: true,
        rateLimit: true,
        requestSizeLimit: securityConfig.requestBodyLimit,
        apiKeyProtection: securityConfig.apiKey.enabled
      },
      blockchain: {
        channelName:
          process.env.FABRIC_CHANNEL_NAME ||
          process.env.CHANNEL_NAME ||
          null,
        chaincodeName:
          process.env.FABRIC_CHAINCODE_NAME ||
          process.env.CHAINCODE_NAME ||
          null,
        mspId:
          process.env.FABRIC_MSP_ID ||
          process.env.MSP_ID ||
          null
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
 * Do NOT mount wallet/transaction/fabric directly here
 * because src/routes/index.js already controls them.
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
        stack: NODE_ENV === "production" ? undefined : error.stack,
        method: req.method,
        url: req.originalUrl,
        requestId: req.requestId
      });
    } else {
      console.error("Unhandled API error:", error);
    }

    if (error.type === "entity.too.large") {
      return res.status(413).json({
        success: false,
        message: "Request payload is too large",
        errorCode: "REQUEST_PAYLOAD_TOO_LARGE",
        data: null,
        meta: null,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
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
    `Security: Helmet=true CORS=true RateLimit=true BodyLimit=${securityConfig.requestBodyLimit}`,
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