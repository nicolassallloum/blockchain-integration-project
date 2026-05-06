'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const requestIdMiddleware = require('./middleware/requestId.middleware');
const auditRequestMiddleware = require('./middleware/auditRequest.middleware');
const errorMiddleware = require('./middleware/error.middleware');

const app = express();

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * ---------------------------------------------------------
 * MANUAL CORS PREFLIGHT HANDLER
 * ---------------------------------------------------------
 * This MUST be the first middleware after app creation.
 * This handles Angular browser OPTIONS preflight requests.
 */
const manualAllowedOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://172.31.13.90:4200'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && manualAllowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type,Authorization,x-request-id,x-api-key,x-correlation-id'
  );
  res.setHeader(
    'Access-Control-Expose-Headers',
    'x-request-id,x-correlation-id'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
});

app.set('trust proxy', true);

/**
 * STEP 28 — Security Controls
 */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false
  })
);

/**
 * Rate limiting
 */
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    errorCode: 'RATE_LIMIT_EXCEEDED',
    data: null
  }
});

app.use(limiter);

/**
 * Request body parsing
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
  console.log(`Blockchain API running on http://${HOST}:${PORT}`);
});

module.exports = app;