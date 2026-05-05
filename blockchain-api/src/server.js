'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const requestIdMiddleware = require('./middleware/requestId.middleware');
const auditRequestMiddleware = require('./middleware/auditRequest.middleware');
const errorMiddleware = require('./middleware/error.middleware');

const app = express();

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';

const NODE_ENV = process.env.NODE_ENV || 'development';

app.set('trust proxy', true);

/**
 * STEP 28 — Security Controls
 */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true
  })
);

const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    errorCode: 'RATE_LIMIT_EXCEEDED'
  }
});

app.use(limiter);

/**
 * Request size limit.
 * Your health response says requestSizeLimit is 1mb, so keep 1mb.
 */
app.use(
  express.json({
    limit: process.env.REQUEST_SIZE_LIMIT || '1mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.REQUEST_SIZE_LIMIT || '1mb'
  })
);

/**
 * STEP 29 — Request ID and Audit Logging
 *
 * Important:
 * These MUST be before /api/v1 routes.
 */
app.use(requestIdMiddleware);
app.use(auditRequestMiddleware);

/**
 * Root route
 */
app.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Blockchain API Middleware is running',
    apiPrefix: '/api/v1',
    health: '/api/v1/health',
    blockchainStatus: '/api/v1/blockchain/status',
    timestamp: new Date().toISOString(),
    requestId: req.requestId || null,
    correlationId: req.correlationId || null
  });
});

/**
 * API routes
 */
app.use('/api/v1', routes);

/**
 * Route not found handler
 */
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errorCode: 'ROUTE_NOT_FOUND',
    data: null,
    meta: null,
    timestamp: new Date().toISOString(),
    requestId: req.requestId || null,
    correlationId: req.correlationId || null
  });
});

/**
 * Global error handler
 */
app.use(errorMiddleware);

/**
 * Process-level error handling
 */
process.on('uncaughtException', (error) => {
  console.error(
    JSON.stringify({
      level: 'error',
      message: `Uncaught Exception ${error.message}`,
      stack: error.stack,
      service: 'Blockchain API Middleware',
      environment: NODE_ENV
    })
  );

  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(
    JSON.stringify({
      level: 'error',
      message: 'Unhandled Promise Rejection',
      reason:
        reason instanceof Error
          ? {
              message: reason.message,
              stack: reason.stack
            }
          : reason,
      service: 'Blockchain API Middleware',
      environment: NODE_ENV
    })
  );
});

app.listen(PORT, HOST, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      message: `Blockchain API Middleware started on ${HOST}:${PORT}`,
      service: 'Blockchain API Middleware',
      environment: NODE_ENV,
      apiPrefix: '/api/v1'
    })
  );
});

module.exports = app;