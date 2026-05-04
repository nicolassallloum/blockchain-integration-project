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
      identity: config.fabric.identity,
      connectionProfile: config.fabric.connectionProfile,
      walletPath: config.fabric.walletPath,
      discoveryEnabled: config.fabric.discovery.enabled,
      discoveryAsLocalhost: config.fabric.discovery.asLocalhost,
    },

    database: {
      postgresHost: config.postgres.host,
      postgresPort: config.postgres.port,
      postgresDatabase: config.postgres.database,
      postgresSchema: config.postgres.schema,
      postgresSsl: config.postgres.ssl,
    },

    couchdb: {
      enabled: config.couchdb.enabled,
      baseUrl: config.couchdb.baseUrl,
      chaincodeDatabase: config.couchdb.chaincodeDatabase,
    },

    logging: {
      level: config.logging.level,
      format: config.logging.format,
      toFile: config.logging.toFile,
    },
  };
}

module.exports = {
  getHealthStatus,
};
