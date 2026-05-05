"use strict";

/**
 * STEP 28 — Secure Transaction Routes
 */

const express = require("express");
const { body, query } = require("express-validator");

const transactionController = require("../controllers/transaction.controller");
const { validateRequest } = require("../middleware/validation.middleware");
const apiKeyProtection = require("../middleware/apiKey.middleware");

let routeSecurity = {};

try {
  routeSecurity = require("../middleware/routeSecurity.middleware");
} catch (error) {
  routeSecurity = {};
}

const router = express.Router();

const passThrough = (req, res, next) => next();

const userOrServiceAccess =
  typeof routeSecurity.userOrServiceAccess === "function"
    ? routeSecurity.userOrServiceAccess
    : passThrough;

const serviceAccess =
  typeof routeSecurity.serviceAccess === "function"
    ? routeSecurity.serviceAccess
    : passThrough;

function unavailableHandler(handlerName) {
  return (req, res) => {
    return res.status(501).json({
      success: false,
      message: `Transaction handler is not implemented: ${handlerName}`,
      errorCode: "TRANSACTION_HANDLER_NOT_IMPLEMENTED",
      availableHandlers: Object.keys(transactionController),
      requestId: req.requestId || req.headers["x-request-id"] || null
    });
  };
}

const walletTransferHandler =
  transactionController.walletTransfer ||
  transactionController.createWalletTransfer ||
  transactionController.transferWalletToWallet ||
  unavailableHandler("walletTransfer");

const organizationTransferHandler =
  transactionController.organizationTransfer ||
  transactionController.createOrganizationTransfer ||
  transactionController.transferToOrganization ||
  unavailableHandler("organizationTransfer");

const getTransactionsHandler =
  transactionController.getTransactions ||
  transactionController.getTransactionHistory ||
  transactionController.searchTransactions ||
  unavailableHandler("getTransactions");

const walletTransferValidation = [
  body("senderWalletAddress")
    .isString()
    .trim()
    .isLength({ min: 10, max: 140 })
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("senderWalletAddress is invalid"),

  body("receiverWalletAddress")
    .isString()
    .trim()
    .isLength({ min: 10, max: 140 })
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("receiverWalletAddress is invalid"),

  body("amount")
    .isDecimal({ decimal_digits: "0,8" })
    .withMessage("amount must be decimal"),

  body("currency")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 10 }),

  body("transactionPurpose")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 }),

  body("transactionDescription")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 }),

  body("requestSource")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 }),

  body("sourceSystem")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 80 }),

  body("createdBy")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
];

const organizationTransferValidation = [
  body("sourceOrganizationId")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 120 }),

  body("targetOrganizationId")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 120 }),

  body("organizationId")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 120 }),

  body("walletAddress")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 140 }),

  body("amount")
    .isDecimal({ decimal_digits: "0,8" })
    .withMessage("amount must be decimal"),

  body("currency")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 10 }),

  body("transactionPurpose")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 }),

  body("transactionDescription")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 }),

  body("requestSource")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 }),

  body("sourceSystem")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 80 }),

  body("createdBy")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
];

const transactionSearchValidation = [
  query("page")
    .optional()
    .isInt({ min: 1, max: 100000 }),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 }),

  query("walletAddress")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 140 }),

  query("customerId")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 80 }),

  query("organizationId")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 120 }),

  query("transactionType")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 80 }),

  query("status")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 }),

  query("dateFrom")
    .optional()
    .isISO8601(),

  query("dateTo")
    .optional()
    .isISO8601(),

  query("amountMin")
    .optional()
    .isDecimal(),

  query("amountMax")
    .optional()
    .isDecimal(),

  query("sortBy")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 }),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc", "ASC", "DESC"])
];

/**
 * POST /api/v1/transactions/wallet-transfer
 */
router.post(
  "/wallet-transfer",
  userOrServiceAccess,
  walletTransferValidation,
  validateRequest,
  walletTransferHandler
);

/**
 * POST /api/v1/transactions/organization-transfer
 */
router.post(
  "/organization-transfer",
  apiKeyProtection,
  serviceAccess,
  organizationTransferValidation,
  validateRequest,
  organizationTransferHandler
);

/**
 * GET /api/v1/transactions
 */
router.get(
  "/",
  userOrServiceAccess,
  transactionSearchValidation,
  validateRequest,
  getTransactionsHandler
);

module.exports = router;