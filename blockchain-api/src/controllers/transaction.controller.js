const transactionService = require("../services/transaction.service");

class TransactionController {
  async walletToWalletTransfer(req, res) {
    const requestId =
      req.headers["x-request-id"] ||
      `REQ_${Date.now()}_${Math.random().toString(16).slice(2).toUpperCase()}`;

    try {
      const result = await transactionService.walletToWalletTransfer({
        requestId,
        body: req.body,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        createdBy: req.body.createdBy || "api_user"
      });

      return res.status(200).json({
        success: true,
        message: "Wallet-to-wallet transfer completed successfully",
        data: result,
        requestId
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        success: false,
        message: error.message || "Wallet-to-wallet transfer failed",
        errorCode: error.errorCode || "WALLET_TRANSFER_FAILED",
        data: null,
        requestId
      });
    }
  }
}

module.exports = new TransactionController();
