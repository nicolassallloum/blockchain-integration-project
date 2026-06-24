require("dotenv").config();

const config = {
  app: {
    name: process.env.APP_NAME || "Blockchain API Middleware",
    version: process.env.APP_VERSION || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT || 3001),
    host: process.env.HOST || "0.0.0.0",
    apiPrefix: process.env.API_PREFIX || "/api/v1"
  },

  postgres: {
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || "172.31.13.133",
    port: Number(process.env.POSTGRES_PORT || process.env.DB_PORT || 5444),
    database: process.env.POSTGRES_DB || process.env.DB_NAME || "vfds_dev",
    user: process.env.POSTGRES_USER || process.env.DB_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
    poolMax: Number(process.env.POSTGRES_POOL_MAX || 20),
    idleTimeout: Number(process.env.POSTGRES_IDLE_TIMEOUT || 30000),
    connectionTimeout: Number(process.env.POSTGRES_CONNECTION_TIMEOUT || 10000)
  },

  fabric: {
    channelName: process.env.FABRIC_CHANNEL_NAME || "kycchannelnix1",
    chaincodeName: process.env.FABRIC_CHAINCODE_NAME || "kyc-wallet-chaincode-js",
    mspId: process.env.FABRIC_MSP_ID || "Org1MSP",
    walletPath: process.env.FABRIC_WALLET_PATH || "./wallet",
    connectionProfilePath:
      process.env.FABRIC_CONNECTION_PROFILE_PATH ||
      "./connection-profile/connection-org1.json",
    identity: process.env.FABRIC_IDENTITY || "appUser"
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || "change-this-secret",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h"
  }
};

module.exports = config;