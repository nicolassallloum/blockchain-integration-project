'use strict';

/**
 * Blockchain API Middleware Server
 * Blockchain Integration Project
 *
 * Updated for:
 * - Angular UI direct CORS support
 * - Browser OPTIONS / preflight handling
 * - /api/v1/data-generator route
 * - /api/v1/organizations route
 * - /api/v1/wallets route
 * - /api/v1/transactions route
 * - /api/v1/fabric route
 * - /api/v1/reference route
 * - Professional request logging
 * - Professional 404 and global error handling
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const os = require('os');

const app = express();
const blockchainKycRoutes = require('./routes/blockchain-kyc.routes');
const governmentBlockchainReferenceRoutes = require('./routes/government-blockchain/reference.routes');
const governmentMinistryRoutes = require('./routes/government-blockchain/ministry.routes');
const governmentBlockchainRoutes = require('./routes/government-blockchain/ministry.routes');

/**
 * Optional packages.
 * Loaded safely so the API does not crash if a package is unavailable.
 */
function optionalRequire(packageName) {
  try {
    return require(packageName);
  } catch (error) {
    console.warn(`[OPTIONAL_PACKAGE_WARNING] Package not available: ${packageName}`);
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
    const route = require(routePath);
    console.log(`[ROUTES] ${routeName} loaded`);
    return route;
  } catch (error) {
    console.error(`[SERVER_ROUTE_LOAD_WARNING] Failed to load ${routeName}:`, error.message);
    return null;
  }
}

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
 *
 * Important:
 * - Browser UI is running on port 4200.
 * - Backend API is running on port 3001.
 * - Browser preflight OPTIONS must be answered before routes/security.
 */
const defaultAllowedOrigins = [
  'http://172.31.13.90:4200',
  'http://172.31.13.90:8080',
  'http://127.0.0.1:4200',
  'http://localhost:4200',
  'http://127.0.0.1:8080',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://localhost:5173'
];

const envAllowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));

const allowedHeaders = [
  'Accept',
  'Content-Type',
  'Authorization',
  'x-api-key',
  'x-request-id',
  'x-correlation-id',
  'x-source-system',
  'x-request-source'
];

const exposedHeaders = [
  'x-request-id',
  'x-correlation-id'
];

const corsOptions = {
  origin(origin, callback) {
    /**
     * Allow:
     * - Server-to-server requests with no Origin header
     * - Browser requests from allowed origins
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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders,
  exposedHeaders,
  credentials: false,
  optionsSuccessStatus: 204,
  preflightContinue: false
};

/**
 * Manual CORS preflight middleware.
 *
 * This is intentionally placed before:
 * - helmet
 * - body parser
 * - route handlers
 * - API key middleware if added later
 *
 * This ensures Angular OPTIONS requests do not stay pending.
 */
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (!origin) {
    return next();
  }

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(','));
    res.setHeader('Access-Control-Expose-Headers', exposedHeaders.join(','));
    res.setHeader('Access-Control-Max-Age', '86400');
  } else {
    console.warn('[CORS_BLOCKED_PREFLIGHT]', {
      origin,
      method: req.method,
      url: req.originalUrl
    });
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
      correlationId: req.correlationId,
      origin: req.headers.origin || null
    });
  });

  return next();
});

/**
 * Route imports.
 *
 * Routes are loaded after middleware definitions but before route registration.
 */
const walletRoutes = safeRoute('./routes/wallet.routes', 'wallet.routes');
const dataGeneratorRoutes = safeRoute('./routes/data-generator.routes', 'data-generator.routes');
const transactionRoutes = safeRoute('./routes/transaction.routes', 'transaction.routes');
const fabricRoutes = safeRoute('./routes/fabric.routes', 'fabric.routes');
const referenceRoutes = safeRoute('./routes/reference.routes', 'reference.routes');
const organizationRoutes = safeRoute('./routes/organization.routes', 'organization.routes');
const projectViewRoutes = safeRoute('./routes/project-view.routes', 'project-view.routes');
const dashboardRoutes = safeRoute('./routes/dashboard.routes', 'dashboard.routes');

/**
 * Optional root API routes aggregator.
 * Keep it optional because some versions of the project may not have src/routes/index.js.
 */
const apiRoutes = safeRoute('./routes', 'routes/index');

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
        hostname: os.hostname(),
        platform: process.platform,
        memoryFree: os.freemem(),
        memoryTotal: os.totalmem()
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
app.use('/api/v1/kyc', blockchainKycRoutes);
if (dataGeneratorRoutes) {
  app.use('/api/v1/data-generator', dataGeneratorRoutes);
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
if (blockchainKycRoutes) {
  app.use('/api/v1/kyc', blockchainKycRoutes);
}

if (organizationRoutes) {
  app.use('/api/v1/organizations', organizationRoutes);
}

if (projectViewRoutes) {
  app.use('/api/v1/project-views', projectViewRoutes);
}

if (dashboardRoutes) {
  app.use('/api/v1/dashboard', dashboardRoutes);
}
if (governmentBlockchainRoutes) {
  app.use('/api/v1/government-blockchain', governmentBlockchainRoutes);;
}
if (governmentBlockchainReferenceRoutes) {
  app.use(
    '/api/v1/government-blockchain/reference',
    governmentBlockchainReferenceRoutes
  );
}
if (governmentMinistryRoutes) {
  app.use(
    '/api/v1/government-blockchain/ministries',
    governmentMinistryRoutes
  );
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
      dataGenerator: '/api/v1/data-generator/run',
      transactions: '/api/v1/transactions',
      fabric: '/api/v1/fabric',
      reference: '/api/v1/reference',
      organizations: '/api/v1/organizations',
      projectViews: '/api/v1/project-views/stats',
      dashboard: '/api/v1/dashboard/summary'
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
    url: req.originalUrl,
    origin: req.headers.origin || null
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
  console.log(`Data Generator: http://${HOST}:${PORT}/api/v1/data-generator/run`);
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