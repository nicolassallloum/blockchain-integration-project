'use strict';

/**
 * Blockchain API - Express Application
 */

require('@dotenvx/dotenvx').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const organizationRoutes = require('./routes/organization.routes');
const routes = require('./routes');
const referenceRoutes = require('./routes/reference.routes');
const blockchainKycRoutes = require('./routes/blockchain-kyc.routes');
const app = express();

/**
 * ---------------------------------------------------------
 * 1. CORS CONFIGURATION
 * ---------------------------------------------------------
 */
const allowedOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://172.31.13.90:4200'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
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
 * ---------------------------------------------------------
 * 2. MANUAL CORS PREFLIGHT HANDLER
 * ---------------------------------------------------------
 * Must be FIRST middleware after app creation.
 */
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
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

/**
 * Normal CORS middleware for non-OPTIONS requests.
 */
app.use(cors(corsOptions));
/**
 * ---------------------------------------------------------
 * 3. SECURITY HEADERS
 * ---------------------------------------------------------
 */
app.use(helmet({
  crossOriginResourcePolicy: {
    policy: 'same-origin'
  }
}));

/**
 * ---------------------------------------------------------
 * 4. BODY PARSERS
 * ---------------------------------------------------------
 */
app.use(express.json({ limit: '10mb' }));

app.use('/api/v1/reference', referenceRoutes);
app.use('/api/v1/kyc', blockchainKycRoutes);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * ---------------------------------------------------------
 * 5. COMPRESSION
 * ---------------------------------------------------------
 */
app.use(compression());

/**
 * ---------------------------------------------------------
 * 6. REQUEST ID / CORRELATION ID
 * ---------------------------------------------------------
 */
app.use((req, res, next) => {
  const incomingRequestId = req.headers['x-request-id'];
  const generatedRequestId = `REQ_${crypto.randomBytes(12).toString('hex').toUpperCase()}`;

  req.requestId = incomingRequestId || generatedRequestId;
  req.correlationId = req.headers['x-correlation-id'] || req.requestId;

  res.setHeader('x-request-id', req.requestId);
  res.setHeader('x-correlation-id', req.correlationId);

  return next();
});

/**
 * ---------------------------------------------------------
 * 7. RATE LIMITING
 * ---------------------------------------------------------
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    errorCode: 'RATE_LIMIT_EXCEEDED',
    data: null
  }
});

app.use(apiLimiter);

/**
 * ---------------------------------------------------------
 * 8. HEALTH CHECK
 * ---------------------------------------------------------
 */
app.get('/health', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Blockchain API is running',
    data: {
      service: 'blockchain-api',
      status: 'UP',
      timestamp: new Date().toISOString()
    },
    requestId: req.requestId,
    correlationId: req.correlationId
  });
});

/**
 * ---------------------------------------------------------
 * 9. API ROUTES
 * ---------------------------------------------------------
 */
app.use('/api/v1', routes);

/**
 * ---------------------------------------------------------
 * 10. ROUTE NOT FOUND HANDLER
 * ---------------------------------------------------------
 */
app.use('/api/v1/organizations', organizationRoutes);

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
// app.use('/api/v1/wallets', walletRoutes);
// app.use('/api/v1/transactions', transactionRoutes);
/**
 * ---------------------------------------------------------
 * 11. GLOBAL ERROR HANDLER
 * ---------------------------------------------------------
 */
app.use((err, req, res, next) => {
  console.error('Global error handler:', {
    message: err.message,
    stack: err.stack,
    requestId: req.requestId,
    correlationId: req.correlationId,
    method: req.method,
    url: req.originalUrl
  });

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    errorCode: err.errorCode || 'SYSTEM_ERROR',
    data: null,
    requestId: req.requestId || null,
    correlationId: req.correlationId || null
  });
});

module.exports = app;
