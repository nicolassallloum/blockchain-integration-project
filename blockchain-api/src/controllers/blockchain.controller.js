const blockchainService = require("../services/blockchain.service");
const { successResponse } = require("../utils/apiResponse");

const getBlockchainStatus = async (req, res) => {
  const status = await blockchainService.getMiddlewareStatus();

  return successResponse({
    res,
    message: "Blockchain middleware status retrieved successfully",
    data: status
  });
};

module.exports = {
  getBlockchainStatus
};
