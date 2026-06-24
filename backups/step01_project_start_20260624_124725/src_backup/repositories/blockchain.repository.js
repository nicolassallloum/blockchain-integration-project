const blockchainConfig = require("../config/blockchain.config");

/**
 * This repository will later connect to Hyperledger Fabric Gateway SDK.
 * For STEP 18, it provides a clean placeholder foundation.
 */
class BlockchainRepository {
  async getNetworkInfo() {
    return {
      channelName: blockchainConfig.fabric.channelName,
      chaincodeName: blockchainConfig.fabric.chaincodeName,
      mspId: blockchainConfig.fabric.mspId,
      walletPath: blockchainConfig.fabric.walletPath,
      connectionProfile: blockchainConfig.fabric.connectionProfile,
      status: "CONFIGURED_PLACEHOLDER"
    };
  }

  async pingLedger() {
    return {
      ledgerReachable: false,
      status: "FABRIC_SDK_NOT_CONNECTED_YET",
      message: "Fabric SDK integration will be implemented in the next steps."
    };
  }
}

module.exports = new BlockchainRepository();
