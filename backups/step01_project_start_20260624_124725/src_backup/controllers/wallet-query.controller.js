const walletQueryService = require("../services/wallet-query.service");

class WalletQueryController {
  async getWalletByAddress(req, res) {
    const requestId =
      req.headers["x-request-id"] ||
      `REQ_${Date.now()}_${Math.random().toString(16).slice(2).toUpperCase()}`;

    try {
      const { walletAddress } = req.params;

      if (!walletAddress || walletAddress.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "walletAddress is required",
          errorCode: "VALIDATION_ERROR",
          data: null,
          requestId,
        });
      }

      const result = await walletQueryService.getWalletByAddress(
        walletAddress,
        requestId
      );

      return res.status(result.httpStatus || 200).json({
        success: result.success,
        message: result.message,
        source: result.source,
        data: result.data,
        requestId,
      });
    } catch (error) {
      console.error("Get wallet by address error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve wallet details",
        errorCode: "WALLET_QUERY_FAILED",
        data: null,
        requestId,
      });
    }
  }

  async getWalletBalance(req, res) {
    const requestId =
      req.headers["x-request-id"] ||
      `REQ_${Date.now()}_${Math.random().toString(16).slice(2).toUpperCase()}`;

    try {
      const { walletAddress } = req.params;

      if (!walletAddress || walletAddress.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "walletAddress is required",
          errorCode: "VALIDATION_ERROR",
          data: null,
          requestId,
        });
      }

      const result = await walletQueryService.getWalletBalance(
        walletAddress,
        requestId
      );

      return res.status(result.httpStatus || 200).json({
        success: result.success,
        message: result.message,
        source: result.source,
        data: result.data,
        requestId,
      });
    } catch (error) {
      console.error("Get wallet balance error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve wallet balance",
        errorCode: "WALLET_BALANCE_QUERY_FAILED",
        data: null,
        requestId,
      });
    }
  }

  async getWalletHistory(req, res) {
    const requestId =
      req.headers["x-request-id"] ||
      `REQ_${Date.now()}_${Math.random().toString(16).slice(2).toUpperCase()}`;

    try {
      const { walletAddress } = req.params;

      const limit = Number(req.query.limit || 50);
      const offset = Number(req.query.offset || 0);

      if (!walletAddress || walletAddress.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "walletAddress is required",
          errorCode: "VALIDATION_ERROR",
          data: null,
          requestId,
        });
      }

      const result = await walletQueryService.getWalletHistory(
        walletAddress,
        {
          limit,
          offset,
        },
        requestId
      );

      return res.status(result.httpStatus || 200).json({
        success: result.success,
        message: result.message,
        source: result.source,
        data: result.data,
        requestId,
      });
    } catch (error) {
      console.error("Get wallet history error:", error);

        return res.status(500).json({
        success: false,
        message: "Failed to retrieve wallet transaction history",
        errorCode: "WALLET_HISTORY_QUERY_FAILED",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
        data: null,
        requestId,
        });
    }
  }
}

module.exports = new WalletQueryController();