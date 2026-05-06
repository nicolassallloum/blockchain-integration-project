require("dotenv").config();

const blockchainConfig = {
  fabric: {
    channelName: process.env.FABRIC_CHANNEL_NAME || "kycchannelnix1",
    chaincodeName: process.env.FABRIC_CHAINCODE_NAME || "kyc-wallet-chaincode-js",
    mspId: process.env.FABRIC_MSP_ID || "Org1MSP",
    walletPath: process.env.FABRIC_WALLET_PATH,
    connectionProfile: process.env.FABRIC_CONNECTION_PROFILE
  }
};

module.exports = blockchainConfig;
