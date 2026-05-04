"use strict";

/**
 * STEP 19 — Configuration Management Layer
 * Project: Blockchain API Middleware
 *
 * This file is responsible for:
 * - Loading .env values
 * - Validating required environment variables
 * - Centralizing all configuration
 * - Preventing weak production secrets
 * - Preparing the API for Fabric, PostgreSQL, CouchDB, JWT, API key, logging, and security middleware
 */

const path = require("path");
const dotenv = require("dotenv");
const Joi = require("joi");
const walletRoutes = require("./wallet.routes");
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
  // Application
  NODE_ENV: Joi.string()
    .valid("development", "test", "staging", "production")
    .default("development"),

  APP_NAME: Joi.string().default("Blockchain API Middleware"),
  APP_VERSION: Joi.string().default("1.0.0"),
  APP_HOST: Joi.string().default("0.0.0.0"),
  APP_PORT: Joi.number().port().default(3001),
  API_PREFIX: Joi.string().default("/api/v1"),

  // Fabric
  FABRIC_CONNECTION_PROFILE: Joi.string().required(),
  FABRIC_CHANNEL_NAME: Joi.string().required(),
  FABRIC_CHAINCODE_NAME: Joi.string().required(),
  FABRIC_WALLET_PATH: Joi.string().required(),
  FABRIC_MSP_ID: Joi.string().required(),
  FABRIC_IDENTITY: Joi.string().required(),

  FABRIC_DISCOVERY_ENABLED: Joi.boolean()
    .truthy("true")
    .falsy("false")
    .default(true),

  FABRIC_DISCOVERY_AS_LOCALHOST: Joi.boolean()
    .truthy("true")
    .falsy("false")
    .default(false),

  FABRIC_COMMIT_TIMEOUT_SECONDS: Joi.number().integer().min(10).default(120),
  FABRIC_ENDORSE_TIMEOUT_SECONDS: Joi.number().integer().min(5).default(30),
  FABRIC_SUBMIT_TIMEOUT_SECONDS: Joi.number().integer().min(5).default(30),
  FABRIC_EVALUATE_TIMEOUT_SECONDS: Joi.number().integer().min(5).default(30),

  // PostgreSQL
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
  POSTGRES_CONNECTION_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .default(10000),

  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default("1h"),
  JWT_ISSUER: Joi.string().default("blockchain-api"),
  JWT_AUDIENCE: Joi.string().default("enterprise-applications"),

  // API Key
  API_KEY: Joi.string().min(24).required(),
  API_KEY_HEADER: Joi.string().default("x-api-key"),

  // CouchDB
  COUCHDB_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
  COUCHDB_PROTOCOL: Joi.string().valid("http", "https").default("http"),
  COUCHDB_HOST: Joi.string().default("127.0.0.1"),
  COUCHDB_PORT: Joi.number().port().default(5984),
  COUCHDB_USERNAME: Joi.string().allow("").default(""),
  COUCHDB_PASSWORD: Joi.string().allow("").default(""),
  COUCHDB_CHAINCODE_DB: Joi.string().allow("").default(""),
  COUCHDB_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid("error", "warn", "info", "http", "verbose", "debug", "silly")
    .default("info"),

  LOG_FORMAT: Joi.string().valid("json", "pretty").default("json"),
  LOG_TO_FILE: Joi.boolean().truthy("true").falsy("false").default(true),
  LOG_FILE_PATH: Joi.string().default("./logs/app.log"),
  ERROR_LOG_FILE_PATH: Joi.string().default("./logs/error.log"),

  // Security
  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),

  CORS_ALLOWED_ORIGINS: Joi.string().allow("").default(""),

  HELMET_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
  COMPRESSION_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),

  // Rate limiting
  RATE_LIMIT_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(60000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(1).default(100),

  // Audit
  AUDIT_LOG_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
  AUDIT_LOG_TO_DATABASE: Joi.boolean().truthy("true").falsy("false").default(true),
  AUDIT_LOG_TO_FILE: Joi.boolean().truthy("true").falsy("false").default(true),

  // Health checks
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

/**
 * Production safety checks.
 */
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
    mspId: process.env.FABRIC_MSP_ID || process.env.FABRIC_ORG_MSP_ID,
    identity: process.env.FABRIC_IDENTITY || process.env.FABRIC_IDENTITY_LABEL,
    channelName: process.env.FABRIC_CHANNEL_NAME,
    chaincodeName: process.env.FABRIC_CHAINCODE_NAME,
    walletPath: process.env.FABRIC_WALLET_PATH,
    connectionProfile: process.env.FABRIC_CONNECTION_PROFILE,
    peerName: process.env.FABRIC_PEER_NAME,
    peerEndpoint: process.env.FABRIC_PEER_ENDPOINT,
    peerTlsHostAlias: process.env.FABRIC_PEER_TLS_HOST_ALIAS
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
