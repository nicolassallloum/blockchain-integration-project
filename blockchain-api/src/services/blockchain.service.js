const blockchainRepository = require("../repositories/blockchain.repository");

class BlockchainService {
  async getMiddlewareStatus() {
    const networkInfo = await blockchainRepository.getNetworkInfo();
    const ledgerPing = await blockchainRepository.pingLedger();

    return {
      middleware: {
        status: "RUNNING",
        component: "Node.js Blockchain API Middleware"
      },
      fabric: networkInfo,
      ledger: ledgerPing
    };
  }
}

module.exports = new BlockchainService();
