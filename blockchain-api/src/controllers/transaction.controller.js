const transactionService = require("../services/transaction.service");
const logger = require("../utils/logger");

/**
 * STEP 23
 * Wallet-to-wallet transfer controller
 */
exports.walletToWalletTransfer = async (req, res) => {
  const requestId =
    req.headers["x-request-id"] ||
    req.body.requestId ||
    `REQ_${Date.now()}`;

  try {
    const result = await transactionService.walletToWalletTransfer({
      ...req.body,
      requestId,
    });

    return res.status(200).json({
      success: true,
      message: "Wallet-to-wallet transfer completed successfully",
      data: result,
      requestId,
    });
  } catch (error) {
    logger.error("Wallet-to-wallet transfer failed", {
      requestId,
      error: error.message,
      stack: error.stack,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Wallet-to-wallet transfer failed",
      errorCode: error.errorCode || "WALLET_TRANSFER_FAILED",
      data: null,
      requestId,
    });
  }
};

/**
 * STEP 24
 * Wallet-to-organization transfer controller
 */
exports.walletToOrganizationTransfer = async (req, res) => {
  const requestId =
    req.headers["x-request-id"] ||
    req.body.requestId ||
    `REQ_${Date.now()}`;

  try {
    const result = await transactionService.walletToOrganizationTransfer({
      ...req.body,
      requestId,
    });

    return res.status(200).json({
      success: true,
      message: "Wallet-to-organization transfer completed successfully",
      data: result,
      requestId,
    });
  } catch (error) {
    logger.error("Wallet-to-organization transfer failed", {
      requestId,
      error: error.message,
      stack: error.stack,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message || "Wallet-to-organization transfer failed",
      errorCode:
        error.errorCode || "ORGANIZATION_TRANSFER_FAILED",
      data: null,
      requestId,
    });
  }
};
