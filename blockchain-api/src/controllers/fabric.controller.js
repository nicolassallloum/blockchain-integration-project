"use strict";

const fabricService = require("../services/fabric.service");

class FabricController {
  async status(req, res) {
    try {
      const result = fabricService.getConnectionInfo();
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to read Fabric SDK configuration.",
        error: {
          message: error.message,
          stack:
            process.env.NODE_ENV === "development"
              ? error.stack
              : undefined
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  async evaluate(req, res) {
    try {
      const { functionName, args } = req.body;

      if (!functionName) {
        return res.status(400).json({
          success: false,
          message: "functionName is required.",
          example: {
            functionName: "GetWalletBalance",
            args: ["WALLET_ADDRESS_HERE"]
          }
        });
      }

      const result = await fabricService.evaluateTransaction(
        functionName,
        args || []
      );

      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Fabric evaluate transaction failed.",
        error: {
          message: error.message,
          stack:
            process.env.NODE_ENV === "development"
              ? error.stack
              : undefined
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  async submit(req, res) {
    try {
      const { functionName, args } = req.body;

      if (!functionName) {
        return res.status(400).json({
          success: false,
          message: "functionName is required.",
          example: {
            functionName: "CreateWallet",
            args: [
              "CUST1003",
              "BANK001",
              "Nicolas Salloum",
              "NID_HASH_1003",
              "MOBILE_HASH_1003",
              "EMAIL_HASH_1003",
              "PASSWORD_HASH_1003",
              "1000"
            ]
          }
        });
      }

      const result = await fabricService.submitTransaction(
        functionName,
        args || []
      );

      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Fabric submit transaction failed.",
        error: {
          message: error.message,
          stack:
            process.env.NODE_ENV === "development"
              ? error.stack
              : undefined
        },
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = new FabricController();
