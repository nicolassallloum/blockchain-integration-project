const walletService = require("../services/wallet.service");

function buildRequestId(req) {
  return (
    req.headers["x-request-id"] ||
    req.body?.requestId ||
    `REQ_${Date.now()}_${Math.random().toString(16).slice(2).toUpperCase()}`
  );
}

exports.createWallet = async (req, res) => {
  const requestId = buildRequestId(req);

  try {
    const result = await walletService.createWallet(
      {
        customerId: req.body.customerId,
        organizationId: req.body.organizationId,
        organizationCode: req.body.organizationCode || req.body.organizationId,
        fullName: req.body.fullName,
        nationalIdHash: req.body.nationalIdHash,
        mobileHash: req.body.mobileHash,
        emailHash: req.body.emailHash,
        passwordHash: req.body.passwordHash,
        initialBalance: req.body.initialBalance,
        currency: req.body.currency || "TOKEN",
        requestSource: req.body.requestSource || "API",
        sourceSystem: req.body.sourceSystem || "BLOCKCHAIN_API",
        createdBy: req.body.createdBy || "system",
      },
      requestId
    );

    return res.status(201).json({
      success: true,
      message: "Wallet created successfully",
      data: result,
      meta: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Wallet creation failed",
      errorCode: error.errorCode || "WALLET_CREATION_FAILED",
      data: null,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
};

exports.getWalletByCustomerId = async (req, res) => {
  const requestId = buildRequestId(req);

  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "customerId is required",
        errorCode: "CUSTOMER_ID_REQUIRED",
        data: null,
        requestId,
      });
    }

    const wallet = await walletService.getWalletByCustomerId(customerId);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: `Wallet not found for customerId: ${customerId}`,
        errorCode: "WALLET_NOT_FOUND",
        data: null,
        requestId,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Wallet retrieved successfully",
      data: wallet,
      requestId,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Wallet query failed",
      errorCode: error.errorCode || "WALLET_QUERY_FAILED",
      data: null,
      requestId,
    });
  }
};

exports.getWalletByAddress = async (req, res) => {
  const requestId = buildRequestId(req);

  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: "walletAddress is required",
        errorCode: "WALLET_ADDRESS_REQUIRED",
        data: null,
        requestId,
      });
    }

    const wallet = await walletService.getWalletByAddress(walletAddress);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: `Wallet not found for walletAddress: ${walletAddress}`,
        errorCode: "WALLET_NOT_FOUND",
        data: null,
        requestId,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Wallet retrieved successfully",
      data: wallet,
      requestId,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Wallet query failed",
      errorCode: error.errorCode || "WALLET_QUERY_FAILED",
      data: null,
      requestId,
    });
  }
};