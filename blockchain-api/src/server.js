'use strict';

/**
 * Blockchain API Middleware Server
 * Blockchain Integration Project
 *
 * Updated for:
 * - Angular UI proxy / direct CORS support
 * - /api/v1/organizations route
 * - /api/v1/wallets route
 * - /api/v1/transactions route
 * - /api/v1/fabric route
 * - /api/v1/reference route
 * - Professional 404 and error handling
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

/**
 * Optional packages.
 * Loaded safely so the API does not crash if a package is unavailable.
 */
function optionalRequire(packageName) {
  try {
    return require(packageName);
  } catch (error) {
    return null;
  }
}

const helmet = optionalRequire('helmet');

/**
 * Route loader.
 * This avoids server crash if a route file is temporarily missing.
 */
function safeRoute(routePath, routeName) {
  try {
    return require(routePath);
  } catch (error) {
    console.error(`[SERVER_ROUTE_LOAD_WARNING] Failed to load ${routeName}:`, error.message);
    return null;
  }
}

/**
 * Route imports.
 */
const walletRoutes = safeRoute('./routes/wallet.routes', 'wallet.routes');
const transactionRoutes = safeRoute('./routes/transaction.routes', 'transaction.routes');
const fabricRoutes = safeRoute('./routes/fabric.routes', 'fabric.routes');
const referenceRoutes = safeRoute('./routes/reference.routes', 'reference.routes');
const organizationRoutes = safeRoute('./routes/organization.routes', 'organization.routes');

/**
 * Optional root API routes aggregator.
 * Keep it optional because some versions of the project may not have src/routes/index.js.
 */
const apiRoutes = safeRoute('./routes', 'routes/index');

/**
 * Server configuration.
 */
const PORT = Number(process.env.PORT || process.env.API_PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';

const SERVICE_NAME = process.env.SERVICE_NAME || 'Blockchain API Middleware';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const NODE_ENV = process.env.NODE_ENV || 'production';

/**
 * CORS configuration.
 */
const defaultAllowedOrigins = [
  'http://172.31.13.90:4200',
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

const envAllowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));

const corsOptions = {
  origin(origin, callback) {
    /**
     * Allow:
     * - Browser requests from allowed origins
     * - Server-to-server requests with no Origin header
     */
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn('[CORS_BLOCKED]', {
      origin,
      allowedOrigins
    });

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-request-id',
    'x-api-key',
    'x-correlation-id'
  ],
  exposedHeaders: [
    'x-request-id',
    'x-correlation-id'
  ],
  optionsSuccessStatus: 204
};

/**
 * Manual CORS preflight handler.
 * Important for Angular/browser OPTIONS requests.
 */
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type,Authorization,x-request-id,x-api-key,x-correlation-id'
    );
    res.setHeader('Access-Control-Expose-Headers', 'x-request-id,x-correlation-id');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
});

/**
 * Normal CORS middleware.
 */
app.use(cors(corsOptions));

/**
 * Security headers.
 */
if (helmet) {
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false
    })
  );
}

/**
 * Body parsers.
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Request ID / Correlation ID middleware.
 */
app.use((req, res, next) => {
  const incomingRequestId =
    req.headers['x-request-id'] ||
    req.headers['x-correlation-id'];

  const requestId =
    incomingRequestId ||
    `REQ_${crypto.randomBytes(12).toString('hex').toUpperCase()}`;

  req.requestId = String(requestId);
  req.correlationId = String(req.headers['x-correlation-id'] || requestId);

  res.setHeader('x-request-id', req.requestId);
  res.setHeader('x-correlation-id', req.correlationId);

  return next();
});

/**
 * Lightweight request logger.
 */
app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;

    console.log('[HTTP_REQUEST]', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      requestId: req.requestId,
      correlationId: req.correlationId
    });
  });

  return next();
});

/**
 * Health endpoint.
 */
app.get('/api/v1/health', (req, res) => {
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
        hostname: require('os').hostname(),
        platform: process.platform,
        memoryFree: require('os').freemem(),
        memoryTotal: require('os').totalmem()
      },
      blockchain: {
        channelName: process.env.FABRIC_CHANNEL_NAME || process.env.CHANNEL_NAME || 'kycchannelnix1',
        chaincodeName:
          process.env.FABRIC_CHAINCODE_NAME ||
          process.env.CHAINCODE_NAME ||
          'kyc-wallet-chaincode-js',
        mspId: process.env.FABRIC_MSP_ID || process.env.MSP_ID || 'Org1MSP'
      }
    },
    meta: null,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    correlationId: req.correlationId
  });
});

/**
 * API routes.
 *
 * IMPORTANT:
 * All route registrations must be BEFORE the 404 handler.
 */
if (walletRoutes) {
  app.use('/api/v1/wallets', walletRoutes);
}

if (transactionRoutes) {
  app.use('/api/v1/transactions', transactionRoutes);
}

if (fabricRoutes) {
  app.use('/api/v1/fabric', fabricRoutes);
}

if (referenceRoutes) {
  app.use('/api/v1/reference', referenceRoutes);
}

/**
 * STEP 32 / UI Support:
 * Required by Angular Create Wallet page.
 */
if (organizationRoutes) {
  app.use('/api/v1/organizations', organizationRoutes);
}

/**
 * Optional generic API route aggregator.
 * Registered after specific routes to avoid overriding them.
 */
if (apiRoutes) {
  app.use('/api/v1', apiRoutes);
}

/**
 * Root endpoint.
 */
app.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    message: SERVICE_NAME,
    data: {
      version: SERVICE_VERSION,
      environment: NODE_ENV,
      health: '/api/v1/health',
      wallets: '/api/v1/wallets',
      transactions: '/api/v1/transactions',
      fabric: '/api/v1/fabric',
      reference: '/api/v1/reference',
      organizations: '/api/v1/organizations'
    },
    requestId: req.requestId,
    correlationId: req.correlationId
  });
});

/**
 * 404 handler.
 * Must stay after all routes.
 */
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errorCode: 'ROUTE_NOT_FOUND',
    data: null,
    meta: null,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    correlationId: req.correlationId || req.requestId
  });
});

/**
 * Global error handler.
 */
app.use((error, req, res, next) => {
  console.error('[GLOBAL_ERROR_HANDLER]', {
    message: error.message,
    code: error.code,
    detail: error.detail,
    constraint: error.constraint,
    table: error.table,
    column: error.column,
    schema: error.schema,
    stack: error.stack,
    requestId: req.requestId,
    correlationId: req.correlationId,
    method: req.method,
    url: req.originalUrl
  });

  const statusCode =
    error.statusCode ||
    error.status ||
    (error.code === '23505' ? 409 : null) ||
    (error.code === '23503' ? 400 : null) ||
    (error.code === '23514' ? 400 : null) ||
    500;

  const isProduction = NODE_ENV === 'production';

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? 'Internal server error'
        : error.message || 'Request failed',
    errorCode: error.code || error.errorCode || 'SYSTEM_ERROR',
    data: null,
    meta: null,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    correlationId: req.correlationId || req.requestId,

    /**
     * Helpful while testing.
     * You can remove debug before production hardening.
     */
    debug: isProduction
      ? undefined
      : {
          message: error.message,
          code: error.code,
          detail: error.detail,
          constraint: error.constraint,
          table: error.table,
          column: error.column,
          schema: error.schema
        }
  });
});

/**
 * Start server.
 */
const server = app.listen(PORT, HOST, () => {
  console.log('======================================================');
  console.log(`${SERVICE_NAME} started successfully`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Listening: http://${HOST}:${PORT}`);
  console.log(`Health: http://${HOST}:${PORT}/api/v1/health`);
  console.log(`Allowed CORS Origins: ${allowedOrigins.join(', ')}`);
  console.log('======================================================');
});

/**
 * Graceful shutdown.
 */
function shutdown(signal) {
  console.log(`[SERVER_SHUTDOWN] Received ${signal}. Closing server...`);

  server.close(() => {
    console.log('[SERVER_SHUTDOWN] HTTP server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[SERVER_SHUTDOWN] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;