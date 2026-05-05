"use strict";

/**
 * STEP 28 — Secure Wallet Routes
 */

const express = require("express");
const { body, param } = require("express-validator");

const walletController = require("../controllers/wallet.controller");
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

function unavailableHandler(handlerName) {
  return (req, res) => {
    return res.status(501).json({
      success: false,
      message: `Wallet handler is not implemented: ${handlerName}`,
      errorCode: "WALLET_HANDLER_NOT_IMPLEMENTED",
      availableHandlers: Object.keys(walletController),
      requestId: req.requestId || req.headers["x-request-id"] || null
    });
  };
}

const createWalletHandler =
  walletController.createWallet ||
  unavailableHandler("createWallet");

const getWalletByCustomerIdHandler =
  walletController.getWalletByCustomerId ||
  unavailableHandler("getWalletByCustomerId");

const getWalletByAddressHandler =
  walletController.getWalletByAddress ||
  unavailableHandler("getWalletByAddress");

const createWalletValidation = [
  body("customerId")
    .isString()
    .trim()
    .isLength({ min: 3, max: 80 })
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("customerId is invalid"),

  body("organizationId")
    .isString()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("organizationId is required"),

  body("fullName")
    .isString()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage("fullName is required"),

  body("nationalIdHash")
    .isString()
    .trim()
    .isLength({ min: 3, max: 255 }),

  body("mobileHash")
    .isString()
    .trim()
    .isLength({ min: 3, max: 255 }),

  body("emailHash")
    .isString()
    .trim()
    .isLength({ min: 3, max: 255 }),

  body("passwordHash")
    .isString()
    .trim()
    .isLength({ min: 3, max: 255 }),

  body("initialBalance")
    .optional()
    .isDecimal()
    .withMessage("initialBalance must be decimal"),

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

const customerIdValidation = [
  param("customerId")
    .isString()
    .trim()
    .isLength({ min: 3, max: 80 })
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("customerId is invalid")
];

const walletAddressValidation = [
  param("walletAddress")
    .isString()
    .trim()
    .isLength({ min: 10, max: 140 })
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("walletAddress is invalid")
];

/**
 * POST /api/v1/wallets
 */
router.post(
  "/",
  apiKeyProtection,
  createWalletValidation,
  validateRequest,
  createWalletHandler
);

/**
 * GET /api/v1/wallets/customer/:customerId
 */
router.get(
  "/customer/:customerId",
  userOrServiceAccess,
  customerIdValidation,
  validateRequest,
  getWalletByCustomerIdHandler
);

/**
 * GET /api/v1/wallets/address/:walletAddress
 */
router.get(
  "/address/:walletAddress",
  userOrServiceAccess,
  walletAddressValidation,
  validateRequest,
  getWalletByAddressHandler
);

module.exports = router;