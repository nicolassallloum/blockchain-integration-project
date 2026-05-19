# 🔹 STEP 19 — Configuration Management

## Project

**Blockchain API Middleware**

## Purpose

This service acts as the middleware layer between enterprise applications and Hyperledger Fabric.

## Current Status

**STEP 19 — Configuration Management** has been implemented and validated successfully.

The API is currently able to:

- Load environment variables from `.env`
- Validate configuration using `Joi`
- Centralize application configuration
- Centralize Hyperledger Fabric configuration
- Centralize PostgreSQL configuration
- Centralize CouchDB awareness configuration
- Centralize JWT and API key configuration
- Centralize logging configuration
- Expose runtime configuration safely through health/status endpoints
- Avoid exposing secrets in API responses
- Handle 404 routes correctly
- Handle application errors centrally
- Start and shut down gracefully

---

# 1. Current Working API Status

The API was successfully started using:

```bash
npm start
```

Current startup command:

```bash
node src/server.js
```

Current working endpoints:

```bash
curl http://127.0.0.1:3001/
curl http://127.0.0.1:3001/api/v1/health
curl http://127.0.0.1:3001/api/v1/blockchain/status
curl http://127.0.0.1:3001/api/v1/test-not-found
```

Validated results:

| Endpoint | Status |
|---|---:|
| `GET /` | ✅ Working |
| `GET /api/v1/health` | ✅ Working |
| `GET /api/v1/blockchain/status` | ✅ Working |
| `GET /api/v1/test-not-found` | ✅ Working |
| Central config loader | ✅ Working |
| Middleware error handling | ✅ Working |
| 404 handling | ✅ Working |
| Logging | ✅ Working |

---

# 2. Final Folder Structure

The correct project structure is:

```txt
blockchain-api/
├── .env
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── logs/
└── src/
    ├── app.js
    ├── server.js
    ├── config/
    │   └── index.js
    ├── controllers/
    │   └── blockchain.controller.js
    ├── middleware/
    │   ├── apiKey.middleware.js
    │   ├── errorHandler.js
    │   └── notFoundHandler.js
    ├── routes/
    │   └── index.js
    ├── services/
    │   ├── blockchain.service.js
    │   └── health.service.js
    └── utils/
        ├── jwt.util.js
        └── logger.js
```

Important correction:

The active config loader is:

```txt
src/config/index.js
```

Not:

```txt
config/config.js
```

---

# 3. Required Packages

Install required packages:

```bash
cd /home/nix/u01/blockchain-integration/blockchain-api

npm install dotenv joi jsonwebtoken
```

If not already installed from STEP 18:

```bash
npm install express helmet cors compression morgan express-rate-limit winston
```

---

# 4. Final `.env.example`

Create or replace:

```bash
nano .env.example
```

Paste:

```env
# ==========================================================
# STEP 19 — Blockchain API Configuration Management
# Project: Blockchain API Middleware
# ==========================================================


# ==========================================================
# APPLICATION CONFIGURATION
# ==========================================================

NODE_ENV=development
APP_NAME=Blockchain API Middleware
APP_VERSION=1.0.0
APP_HOST=0.0.0.0
APP_PORT=3001
API_PREFIX=/api/v1


# ==========================================================
# HYPERLEDGER FABRIC CONFIGURATION
# ==========================================================

FABRIC_CONNECTION_PROFILE=/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/connection-org1.json
FABRIC_CHANNEL_NAME=kycchannelnix1
FABRIC_CHAINCODE_NAME=kyc-wallet-chaincode-js
FABRIC_WALLET_PATH=/home/nix/u01/blockchain-integration/blockchain-api/wallet
FABRIC_MSP_ID=Org1MSP
FABRIC_IDENTITY=appUser

FABRIC_DISCOVERY_ENABLED=true
FABRIC_DISCOVERY_AS_LOCALHOST=false

FABRIC_COMMIT_TIMEOUT_SECONDS=120
FABRIC_ENDORSE_TIMEOUT_SECONDS=30
FABRIC_SUBMIT_TIMEOUT_SECONDS=30
FABRIC_EVALUATE_TIMEOUT_SECONDS=30


# ==========================================================
# POSTGRESQL CONFIGURATION
# ==========================================================

POSTGRES_HOST=172.31.13.133
POSTGRES_PORT=5444
POSTGRES_DATABASE=vfds_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_SCHEMA=blockchain

POSTGRES_SSL=false
POSTGRES_POOL_MIN=2
POSTGRES_POOL_MAX=20
POSTGRES_IDLE_TIMEOUT_MS=30000
POSTGRES_CONNECTION_TIMEOUT_MS=10000


# ==========================================================
# JWT CONFIGURATION
# ==========================================================

JWT_SECRET=CHANGE_ME_WITH_STRONG_64_CHARACTER_SECRET
JWT_EXPIRES_IN=1h
JWT_ISSUER=blockchain-api
JWT_AUDIENCE=enterprise-applications


# ==========================================================
# API KEY CONFIGURATION
# ==========================================================

API_KEY=CHANGE_ME_WITH_STRONG_INTERNAL_API_KEY
API_KEY_HEADER=x-api-key


# ==========================================================
# COUCHDB AWARENESS CONFIGURATION
# Used for monitoring, health checks, and Fabric state DB awareness.
# Do not treat CouchDB as the application source of truth.
# ==========================================================

COUCHDB_ENABLED=true
COUCHDB_PROTOCOL=http
COUCHDB_HOST=127.0.0.1
COUCHDB_PORT=5984
COUCHDB_USERNAME=admin
COUCHDB_PASSWORD=adminpw
COUCHDB_CHAINCODE_DB=kycchannelnix1_kyc-wallet-chaincode-js
COUCHDB_TIMEOUT_MS=10000


# ==========================================================
# LOGGING CONFIGURATION
# ==========================================================

LOG_LEVEL=info
LOG_FORMAT=json
LOG_TO_FILE=true
LOG_FILE_PATH=/home/nix/u01/blockchain-integration/blockchain-api/logs/app.log
ERROR_LOG_FILE_PATH=/home/nix/u01/blockchain-integration/blockchain-api/logs/error.log


# ==========================================================
# SECURITY CONFIGURATION
# ==========================================================

BCRYPT_SALT_ROUNDS=12

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173

HELMET_ENABLED=true
COMPRESSION_ENABLED=true


# ==========================================================
# RATE LIMITING CONFIGURATION
# ==========================================================

RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100


# ==========================================================
# AUDIT CONFIGURATION
# ==========================================================

AUDIT_LOG_ENABLED=true
AUDIT_LOG_TO_DATABASE=true
AUDIT_LOG_TO_FILE=true


# ==========================================================
# HEALTH CHECK CONFIGURATION
# ==========================================================

HEALTH_CHECK_FABRIC=true
HEALTH_CHECK_POSTGRES=true
HEALTH_CHECK_COUCHDB=true
```

---

# 5. Create Real `.env`

If `.env` does not exist:

```bash
cp .env.example .env
nano .env
```

Generate strong secrets:

```bash
openssl rand -hex 64
openssl rand -hex 48
```

Update at minimum:

```env
JWT_SECRET=<strong_64_character_secret>
API_KEY=<strong_internal_api_key>
POSTGRES_PASSWORD=<real_postgres_password>
COUCHDB_PASSWORD=<real_couchdb_password>
```

---

# 6. Final Config Loader

Create or replace:

```bash
nano src/config/index.js
```

Paste:

```js
"use strict";

/**
 * STEP 19 — Configuration Management Layer
 * Project: Blockchain API Middleware
 */

const path = require("path");
const dotenv = require("dotenv");
const Joi = require("joi");

dotenv.config();

function toArray(value) {
  if (!value || typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "staging", "production")
    .default("development"),

  APP_NAME: Joi.string().default("Blockchain API Middleware"),
  APP_VERSION: Joi.string().default("1.0.0"),
  APP_HOST: Joi.string().default("0.0.0.0"),
  APP_PORT: Joi.number().port().default(3001),
  API_PREFIX: Joi.string().default("/api/v1"),

  FABRIC_CONNECTION_PROFILE: Joi.string().required(),
  FABRIC_CHANNEL_NAME: Joi.string().required(),
  FABRIC_CHAINCODE_NAME: Joi.string().required(),
  FABRIC_WALLET_PATH: Joi.string().required(),
  FABRIC_MSP_ID: Joi.string().required(),
  FABRIC_IDENTITY: Joi.string().required(),

  FABRIC_DISCOVERY_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
  FABRIC_DISCOVERY_AS_LOCALHOST: Joi.boolean().truthy("true").falsy("false").default(false),

  FABRIC_COMMIT_TIMEOUT_SECONDS: Joi.number().integer().min(10).default(120),
  FABRIC_ENDORSE_TIMEOUT_SECONDS: Joi.number().integer().min(5).default(30),
  FABRIC_SUBMIT_TIMEOUT_SECONDS: Joi.number().integer().min(5).default(30),
  FABRIC_EVALUATE_TIMEOUT_SECONDS: Joi.number().integer().min(5).default(30),

  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().port().default(5432),
  POSTGRES_DATABASE: Joi.string().required(),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_SCHEMA: Joi.string().default("blockchain"),

  POSTGRES_SSL: Joi.boolean().truthy("true").falsy("false").default(false),
  POSTGRES_POOL_MIN: Joi.number().integer().min(0).default(2),
  POSTGRES_POOL_MAX: Joi.number().integer().min(1).default(20),
  POSTGRES_IDLE_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
  POSTGRES_CONNECTION_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default("1h"),
  JWT_ISSUER: Joi.string().default("blockchain-api"),
  JWT_AUDIENCE: Joi.string().default("enterprise-applications"),

  API_KEY: Joi.string().min(24).required(),
  API_KEY_HEADER: Joi.string().default("x-api-key"),

  COUCHDB_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
  COUCHDB_PROTOCOL: Joi.string().valid("http", "https").default("http"),
  COUCHDB_HOST: Joi.string().default("127.0.0.1"),
  COUCHDB_PORT: Joi.number().port().default(5984),
  COUCHDB_USERNAME: Joi.string().allow("").default(""),
  COUCHDB_PASSWORD: Joi.string().allow("").default(""),
  COUCHDB_CHAINCODE_DB: Joi.string().allow("").default(""),
  COUCHDB_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),

  LOG_LEVEL: Joi.string()
    .valid("error", "warn", "info", "http", "verbose", "debug", "silly")
    .default("info"),

  LOG_FORMAT: Joi.string().valid("json", "pretty").default("json"),
  LOG_TO_FILE: Joi.boolean().truthy("true").falsy("false").default(true),
  LOG_FILE_PATH: Joi.string().default("./logs/app.log"),
  ERROR_LOG_FILE_PATH: Joi.string().default("./logs/error.log"),

  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),

  CORS_ALLOWED_ORIGINS: Joi.string().allow("").default(""),

  HELMET_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
  COMPRESSION_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),

  RATE_LIMIT_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(60000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(1).default(100),

  AUDIT_LOG_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
  AUDIT_LOG_TO_DATABASE: Joi.boolean().truthy("true").falsy("false").default(true),
  AUDIT_LOG_TO_FILE: Joi.boolean().truthy("true").falsy("false").default(true),

  HEALTH_CHECK_FABRIC: Joi.boolean().truthy("true").falsy("false").default(true),
  HEALTH_CHECK_POSTGRES: Joi.boolean().truthy("true").falsy("false").default(true),
  HEALTH_CHECK_COUCHDB: Joi.boolean().truthy("true").falsy("false").default(true),
})
  .unknown(true)
  .required();

const { value: env, error } = envSchema.validate(process.env, {
  abortEarly: false,
  convert: true,
});

if (error) {
  const validationMessages = error.details
    .map((detail) => `- ${detail.message}`)
    .join("\n");

  throw new Error(
    `Configuration validation failed:\n${validationMessages}\n\nPlease check your .env file.`
  );
}

if (env.NODE_ENV === "production") {
  const unsafeValues = [
    "CHANGE_ME",
    "CHANGE_ME_WITH_STRONG_64_CHARACTER_SECRET",
    "CHANGE_ME_WITH_STRONG_INTERNAL_API_KEY",
    "password",
    "secret",
    "admin",
    "postgres",
  ];

  const secretsToCheck = {
    JWT_SECRET: env.JWT_SECRET,
    API_KEY: env.API_KEY,
    POSTGRES_PASSWORD: env.POSTGRES_PASSWORD,
    COUCHDB_PASSWORD: env.COUCHDB_PASSWORD,
  };

  Object.entries(secretsToCheck).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    if (unsafeValues.includes(String(value).trim())) {
      throw new Error(
        `Unsafe production configuration: ${key} contains a default or weak value.`
      );
    }
  });

  if (env.JWT_SECRET.length < 64) {
    throw new Error("JWT_SECRET must be at least 64 characters in production.");
  }

  if (env.API_KEY.length < 48) {
    throw new Error("API_KEY must be at least 48 characters in production.");
  }
}

const config = {
  app: {
    name: env.APP_NAME,
    version: env.APP_VERSION,
    env: env.NODE_ENV,
    host: env.APP_HOST,
    port: env.APP_PORT,
    apiPrefix: env.API_PREFIX,

    isDevelopment: env.NODE_ENV === "development",
    isTest: env.NODE_ENV === "test",
    isStaging: env.NODE_ENV === "staging",
    isProduction: env.NODE_ENV === "production",
  },

  fabric: {
    connectionProfile: path.resolve(env.FABRIC_CONNECTION_PROFILE),
    channelName: env.FABRIC_CHANNEL_NAME,
    chaincodeName: env.FABRIC_CHAINCODE_NAME,
    walletPath: path.resolve(env.FABRIC_WALLET_PATH),
    mspId: env.FABRIC_MSP_ID,
    identity: env.FABRIC_IDENTITY,

    discovery: {
      enabled: env.FABRIC_DISCOVERY_ENABLED,
      asLocalhost: env.FABRIC_DISCOVERY_AS_LOCALHOST,
    },

    timeouts: {
      commitSeconds: env.FABRIC_COMMIT_TIMEOUT_SECONDS,
      endorseSeconds: env.FABRIC_ENDORSE_TIMEOUT_SECONDS,
      submitSeconds: env.FABRIC_SUBMIT_TIMEOUT_SECONDS,
      evaluateSeconds: env.FABRIC_EVALUATE_TIMEOUT_SECONDS,
    },
  },

  postgres: {
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DATABASE,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    schema: env.POSTGRES_SCHEMA,
    ssl: env.POSTGRES_SSL,

    pool: {
      min: env.POSTGRES_POOL_MIN,
      max: env.POSTGRES_POOL_MAX,
      idleTimeoutMillis: env.POSTGRES_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: env.POSTGRES_CONNECTION_TIMEOUT_MS,
    },
  },

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  },

  apiKey: {
    key: env.API_KEY,
    header: env.API_KEY_HEADER.toLowerCase(),
  },

  couchdb: {
    enabled: env.COUCHDB_ENABLED,
    protocol: env.COUCHDB_PROTOCOL,
    host: env.COUCHDB_HOST,
    port: env.COUCHDB_PORT,
    username: env.COUCHDB_USERNAME,
    password: env.COUCHDB_PASSWORD,
    chaincodeDatabase: env.COUCHDB_CHAINCODE_DB,
    timeoutMs: env.COUCHDB_TIMEOUT_MS,
    baseUrl: `${env.COUCHDB_PROTOCOL}://${env.COUCHDB_HOST}:${env.COUCHDB_PORT}`,
  },

  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
    toFile: env.LOG_TO_FILE,
    appLogPath: path.resolve(env.LOG_FILE_PATH),
    errorLogPath: path.resolve(env.ERROR_LOG_FILE_PATH),
  },

  security: {
    bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
    corsAllowedOrigins: toArray(env.CORS_ALLOWED_ORIGINS),
    helmetEnabled: env.HELMET_ENABLED,
    compressionEnabled: env.COMPRESSION_ENABLED,
  },

  rateLimit: {
    enabled: env.RATE_LIMIT_ENABLED,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  audit: {
    enabled: env.AUDIT_LOG_ENABLED,
    toDatabase: env.AUDIT_LOG_TO_DATABASE,
    toFile: env.AUDIT_LOG_TO_FILE,
  },

  healthChecks: {
    fabric: env.HEALTH_CHECK_FABRIC,
    postgres: env.HEALTH_CHECK_POSTGRES,
    couchdb: env.HEALTH_CHECK_COUCHDB,
  },
};

module.exports = config;
```

---

# 7. Middleware Files Required by `src/app.js`

## 7.1 `src/middleware/notFoundHandler.js`

```bash
nano src/middleware/notFoundHandler.js
```

```js
"use strict";

function notFoundHandler(req, res, next) {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    data: null,
    meta: null,
    timestamp: new Date().toISOString(),
  });
}

module.exports = notFoundHandler;
```

## 7.2 `src/middleware/errorHandler.js`

```bash
nano src/middleware/errorHandler.js
```

```js
"use strict";

const config = require("../config");
const logger = require("../utils/logger");

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || error.status || 500;

  logger.error("Application error", {
    message: error.message,
    stack: config.app.isProduction ? undefined : error.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  return res.status(statusCode).json({
    success: false,
    message: config.app.isProduction
      ? "Internal server error"
      : error.message || "Internal server error",
    data: null,
    meta: null,
    timestamp: new Date().toISOString(),
  });
}

module.exports = errorHandler;
```

## 7.3 `src/middleware/apiKey.middleware.js`

```bash
nano src/middleware/apiKey.middleware.js
```

```js
"use strict";

const config = require("../config");

function apiKeyMiddleware(req, res, next) {
  const incomingApiKey = req.headers[config.apiKey.header];

  if (!incomingApiKey) {
    return res.status(401).json({
      success: false,
      message: "Missing API key.",
      data: null,
      meta: null,
      timestamp: new Date().toISOString(),
    });
  }

  if (incomingApiKey !== config.apiKey.key) {
    return res.status(403).json({
      success: false,
      message: "Invalid API key.",
      data: null,
      meta: null,
      timestamp: new Date().toISOString(),
    });
  }

  return next();
}

module.exports = apiKeyMiddleware;
```

---

# 8. Final Blockchain Status Service

Create or replace:

```bash
nano src/services/blockchain.service.js
```

Paste:

```js
"use strict";

const config = require("../config");

/**
 * Blockchain Status Service
 *
 * Current purpose:
 * - Expose middleware blockchain configuration status
 * - Confirm Fabric-related environment variables are loaded
 * - Confirm PostgreSQL and CouchDB awareness configuration
 *
 * Real Fabric Gateway connection will be added in the next blockchain integration step.
 */
function getMiddlewareStatus() {
  return {
    middleware: {
      status: "running",
      service: config.app.name,
      version: config.app.version,
      environment: config.app.env,
      apiPrefix: config.app.apiPrefix,
      timestamp: new Date().toISOString(),
    },

    fabric: {
      status: "configured",
      connectionMode: "placeholder",
      connectionProfile: config.fabric.connectionProfile,
      channelName: config.fabric.channelName,
      chaincodeName: config.fabric.chaincodeName,
      walletPath: config.fabric.walletPath,
      mspId: config.fabric.mspId,
      identity: config.fabric.identity,
      discovery: {
        enabled: config.fabric.discovery.enabled,
        asLocalhost: config.fabric.discovery.asLocalhost,
      },
      timeouts: config.fabric.timeouts,
    },

    postgres: {
      status: "configured",
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      schema: config.postgres.schema,
      ssl: config.postgres.ssl,
      pool: config.postgres.pool,
    },

    couchdb: {
      enabled: config.couchdb.enabled,
      status: config.couchdb.enabled ? "configured" : "disabled",
      baseUrl: config.couchdb.baseUrl,
      chaincodeDatabase: config.couchdb.chaincodeDatabase,
      purpose: "Fabric state database awareness, monitoring, and troubleshooting only",
    },

    security: {
      jwtConfigured: Boolean(config.jwt.secret),
      apiKeyConfigured: Boolean(config.apiKey.key),
      apiKeyHeader: config.apiKey.header,
      corsConfigured: config.security.corsAllowedOrigins.length > 0,
      helmetEnabled: config.security.helmetEnabled,
      compressionEnabled: config.security.compressionEnabled,
      rateLimitEnabled: config.rateLimit.enabled,
    },

    logging: {
      level: config.logging.level,
      format: config.logging.format,
      toFile: config.logging.toFile,
      appLogPath: config.logging.appLogPath,
      errorLogPath: config.logging.errorLogPath,
    },

    message:
      "Blockchain API Middleware configuration is loaded successfully. Real Fabric Gateway connection will be activated in the next integration step.",
  };
}

function getBlockchainStatus() {
  return getMiddlewareStatus();
}

module.exports = {
  getMiddlewareStatus,
  getBlockchainStatus,
};
```

---

# 9. Final Health Service

Create or replace:

```bash
nano src/services/health.service.js
```

Paste:

```js
"use strict";

const os = require("os");
const config = require("../config");

function getHealthStatus() {
  return {
    service: config.app.name,
    version: config.app.version,
    environment: config.app.env,
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),

    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      memoryFree: os.freemem(),
      memoryTotal: os.totalmem(),
    },

    blockchain: {
      channelName: config.fabric.channelName,
      chaincodeName: config.fabric.chaincodeName,
      mspId: config.fabric.mspId,
    },
  };
}

module.exports = {
  getHealthStatus,
};
```

---

# 10. Logger File

Create or replace:

```bash
nano src/utils/logger.js
```

Paste:

```js
"use strict";

const fs = require("fs");
const path = require("path");
const winston = require("winston");
const config = require("../config");

const logDirectory = path.dirname(config.logging.appLogPath);

if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

const logFormat =
  config.logging.format === "json"
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaText = Object.keys(meta).length
            ? JSON.stringify(meta, null, 2)
            : "";

          return `${timestamp} [${level}]: ${message} ${metaText}`;
        })
      );

const transports = [
  new winston.transports.Console({
    level: config.logging.level,
  }),
];

if (config.logging.toFile) {
  transports.push(
    new winston.transports.File({
      filename: config.logging.appLogPath,
      level: config.logging.level,
    })
  );

  transports.push(
    new winston.transports.File({
      filename: config.logging.errorLogPath,
      level: "error",
    })
  );
}

const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: {
    service: config.app.name,
    environment: config.app.env,
  },
  transports,
  exitOnError: false,
});

module.exports = logger;
```

---

# 11. JWT Utility

Create or replace:

```bash
nano src/utils/jwt.util.js
```

Paste:

```js
"use strict";

const jwt = require("jsonwebtoken");
const config = require("../config");

function signToken(payload) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
}

function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret, {
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
}

module.exports = {
  signToken,
  verifyToken,
};
```

---

# 12. `.gitignore`

Create or update:

```bash
nano .gitignore
```

Add:

```gitignore
node_modules/
logs/

.env
.env.*
!.env.example

wallet/
*.pem
*.key
*.crt

npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

---

# 13. Fix Port Already in Use

If you see:

```txt
EADDRINUSE: address already in use 0.0.0.0:3001
```

It means another API instance is already running.

Find the process:

```bash
sudo ss -tulpn | grep 3001
```

Stop it:

```bash
sudo fuser -k 3001/tcp
```

Then start again:

```bash
npm start
```

---

# 14. Final Validation Commands

Run:

```bash
node -c src/config/index.js
node -c src/middleware/notFoundHandler.js
node -c src/middleware/errorHandler.js
node -c src/middleware/apiKey.middleware.js
node -c src/services/blockchain.service.js
node -c src/services/health.service.js
node -c src/utils/logger.js
node -c src/utils/jwt.util.js
node -c src/app.js
node -c src/server.js
```

Test config:

```bash
node -e "const config = require('./src/config'); console.log(config.app); console.log(config.fabric);"
```

Start server:

```bash
npm start
```

Test endpoints:

```bash
curl http://127.0.0.1:3001/
curl http://127.0.0.1:3001/api/v1/health
curl http://127.0.0.1:3001/api/v1/blockchain/status
curl http://127.0.0.1:3001/api/v1/test-not-found
```

---

# 15. Expected Blockchain Status Output

Expected result:

```json
{
  "success": true,
  "message": "Blockchain middleware status retrieved successfully",
  "data": {
    "middleware": {
      "status": "running",
      "service": "Blockchain API Middleware",
      "version": "1.0.0",
      "environment": "development",
      "apiPrefix": "/api/v1"
    },
    "fabric": {
      "status": "configured",
      "connectionMode": "placeholder",
      "channelName": "kycchannelnix1",
      "chaincodeName": "kyc-wallet-chaincode-js",
      "mspId": "Org1MSP",
      "identity": "appUser"
    },
    "postgres": {
      "status": "configured",
      "host": "172.31.13.133",
      "port": 5444,
      "database": "vfds_dev",
      "schema": "blockchain"
    },
    "couchdb": {
      "enabled": true,
      "status": "configured",
      "baseUrl": "http://127.0.0.1:5984",
      "chaincodeDatabase": "kycchannelnix1_kyc-wallet-chaincode-js"
    },
    "security": {
      "jwtConfigured": true,
      "apiKeyConfigured": true,
      "apiKeyHeader": "x-api-key",
      "helmetEnabled": true,
      "compressionEnabled": true,
      "rateLimitEnabled": true
    }
  }
}
```

---

# 16. Security Notes

Never expose or commit:

```txt
.env
JWT_SECRET
API_KEY
POSTGRES_PASSWORD
COUCHDB_PASSWORD
Fabric wallet private keys
TLS private keys
Admin identity private keys
```

Do not expose secrets in:

```txt
Health endpoint
Blockchain status endpoint
Application logs
Error responses
Git repository
Documentation screenshots
```

Use dedicated identities:

```txt
Fabric Admin identity   → Network administration only
Fabric apiUser identity → Application transaction submit/evaluate
PostgreSQL app user     → API database access
Auditor identity        → Read-only audit operations
```

---

# 17. Production Recommendations

For production:

```env
NODE_ENV=production
LOG_LEVEL=warn
LOG_FORMAT=json
POSTGRES_SSL=true
FABRIC_DISCOVERY_AS_LOCALHOST=false
```

Use strong secrets:

```bash
openssl rand -hex 64
openssl rand -hex 48
```

Recommended production PostgreSQL user:

```sql
CREATE USER blockchain_api_user WITH PASSWORD 'STRONG_PASSWORD';

GRANT USAGE ON SCHEMA blockchain TO blockchain_api_user;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA blockchain TO blockchain_api_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA blockchain
GRANT SELECT, INSERT, UPDATE ON TABLES TO blockchain_api_user;
```

Use:

```env
POSTGRES_USER=blockchain_api_user
```

Avoid in production:

```env
POSTGRES_USER=postgres
FABRIC_IDENTITY=Admin
JWT_SECRET=CHANGE_ME
API_KEY=CHANGE_ME
```

---

# 18. STEP 19 Completion Checklist

| Item | Status |
|---|---:|
| `.env.example` updated | ✅ |
| `.env` loaded | ✅ |
| `src/config/index.js` implemented | ✅ |
| Environment validation added | ✅ |
| Production safety checks added | ✅ |
| Fabric config centralized | ✅ |
| PostgreSQL config centralized | ✅ |
| JWT config centralized | ✅ |
| API key config centralized | ✅ |
| CouchDB awareness centralized | ✅ |
| Logging config centralized | ✅ |
| Environment mode centralized | ✅ |
| 404 middleware added | ✅ |
| Error handler added | ✅ |
| Blockchain status fixed | ✅ |
| Health endpoint still working | ✅ |
| Port conflict documented | ✅ |
| Security notes added | ✅ |
| Production recommendations added | ✅ |

---

# ✅ STEP 19 Result

**STEP 19 — Configuration Management** is complete.

The Blockchain API Middleware now has a centralized, validated, and production-ready configuration layer.

The project is ready for:

```txt
🔹 STEP 20 — Security Middleware Layer
```

Recommended STEP 20 scope:

```txt
JWT authentication middleware
API key route protection
Request correlation ID
Audit middleware
Role-based authorization
Secure error masking
Input validation preparation
Protected blockchain routes
```
