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
 * Note:
 * This is still a placeholder status service.
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

/**
 * Alias kept for compatibility.
 * Some controllers may call getBlockchainStatus().
 */
function getBlockchainStatus() {
  return getMiddlewareStatus();
}

module.exports = {
  getMiddlewareStatus,
  getBlockchainStatus,
};