const os = require("os");
const appConfig = require("../config/app.config");
const blockchainConfig = require("../config/blockchain.config");
const { successResponse } = require("../utils/apiResponse");

const getHealthStatus = (req, res) => {
  return successResponse({
    res,
    message: "Blockchain API Middleware is healthy",
    data: {
      service: appConfig.name,
      version: appConfig.version,
      environment: appConfig.env,
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        memoryFree: os.freemem(),
        memoryTotal: os.totalmem()
      },
      blockchain: {
        channelName: blockchainConfig.fabric.channelName,
        chaincodeName: blockchainConfig.fabric.chaincodeName,
        mspId: blockchainConfig.fabric.mspId
      }
    }
  });
};

module.exports = {
  getHealthStatus
};
