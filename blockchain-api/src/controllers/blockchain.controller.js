"use strict";

const blockchainService = require("../services/blockchain.service");
const blockchainApiProofService = require("../services/blockchain-api-proof.service");
const { successResponse } = require("../utils/apiResponse");

const getBlockchainStatus = async (req, res) => {
  const status = await blockchainService.getMiddlewareStatus();

  return successResponse({
    res,
    message: "Blockchain middleware status retrieved successfully",
    data: status
  });
};

const submitProof = async (req, res) => {
  try {
    const data = await blockchainApiProofService.submitProof(req.body, {
      requestId: req.headers["x-request-id"] || null,
      correlationId: req.headers["x-correlation-id"] || null
    });

    return res.status(201).json({
      success: true,
      message: "Blockchain proof submitted successfully",
      data
    });
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Blockchain proof submission failed",
      code: error.code || "BLOCKCHAIN_PROOF_SUBMIT_FAILED",
      details: error.details || null
    });
  }
};


const getProof = async (req, res) => {
  try {
    const data = await blockchainApiProofService.getProof(req.params.key, {
      requestId: req.headers["x-request-id"] || null,
      correlationId: req.headers["x-correlation-id"] || null,
      requestedBy: req.headers["x-requested-by"] || "phase11-api-client"
    });

    return res.status(200).json({
      success: true,
      message: "Blockchain proof loaded successfully",
      data
    });
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Blockchain proof lookup failed",
      code: error.code || "BLOCKCHAIN_PROOF_LOOKUP_FAILED",
      details: error.details || null
    });
  }
};



const verifyProof = async (req, res) => {
  try {
    const data = await blockchainApiProofService.verifyProof(req.body, {
      requestId: req.headers["x-request-id"] || null,
      correlationId: req.headers["x-correlation-id"] || null,
      requestedBy: req.headers["x-requested-by"] || "phase11-api-client"
    });

    return res.status(200).json({
      success: true,
      message: data.verified
        ? "Blockchain proof verified successfully"
        : "Blockchain proof verification completed with mismatch",
      data
    });
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Blockchain proof verification failed",
      code: error.code || "BLOCKCHAIN_PROOF_VERIFY_FAILED",
      details: error.details || null
    });
  }
};



const getHistory = async (req, res) => {
  try {
    const data = await blockchainApiProofService.getHistoryByRecordId(
      req.params.recordId,
      {
        requestId: req.headers["x-request-id"] || null,
        correlationId: req.headers["x-correlation-id"] || null,
        requestedBy: req.headers["x-requested-by"] || "phase11-api-client"
      }
    );

    return res.status(200).json({
      success: true,
      message: "Blockchain history loaded successfully",
      data
    });
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Blockchain history lookup failed",
      code: error.code || "BLOCKCHAIN_HISTORY_LOOKUP_FAILED",
      details: error.details || null
    });
  }
};



const getDashboard = async (req, res) => {
  try {
    const data = await blockchainApiProofService.getDashboard({
      limit: req.query.limit
    });

    return res.status(200).json({
      success: true,
      message: "Blockchain dashboard loaded successfully",
      data
    });
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Blockchain dashboard lookup failed",
      code: error.code || "BLOCKCHAIN_DASHBOARD_LOOKUP_FAILED",
      details: error.details || null
    });
  }
};


module.exports = {
  getBlockchainStatus,
  submitProof,
  getProof,
  verifyProof,
  getHistory,
  getDashboard
};
