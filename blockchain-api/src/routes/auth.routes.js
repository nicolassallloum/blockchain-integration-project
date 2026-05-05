"use strict";

/**
 * STEP 28 — Secure Auth Routes
 */

const express = require("express");
const { body } = require("express-validator");

const authController = require("../controllers/auth.controller");
const { validateRequest } = require("../middleware/validation.middleware");
const { authRateLimiter } = require("../middleware/rateLimit.middleware");

let routeSecurity = {};

try {
  routeSecurity = require("../middleware/routeSecurity.middleware");
} catch (error) {
  routeSecurity = {};
}

const router = express.Router();

const passThrough = (req, res, next) => next();

const userAccess =
  typeof routeSecurity.userAccess === "function"
    ? routeSecurity.userAccess
    : passThrough;

const serviceAccess =
  typeof routeSecurity.serviceAccess === "function"
    ? routeSecurity.serviceAccess
    : passThrough;

function unavailableHandler(handlerName) {
  return (req, res) => {
    return res.status(501).json({
      success: false,
      message: `Auth handler is not implemented: ${handlerName}`,
      errorCode: "AUTH_HANDLER_NOT_IMPLEMENTED",
      availableHandlers: Object.keys(authController),
      requestId: req.requestId || req.headers["x-request-id"] || null
    });
  };
}

const loginHandler =
  authController.login ||
  authController.loginWallet ||
  authController.walletLogin ||
  authController.authenticate ||
  unavailableHandler("login");

const systemTokenHandler =
  authController.systemToken ||
  authController.generateSystemToken ||
  authController.createSystemToken ||
  unavailableHandler("systemToken");

const meHandler =
  authController.me ||
  authController.getMe ||
  authController.getCurrentUser ||
  unavailableHandler("me");

const loginValidation = [
  body("customerId")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 80 }),

  body("walletAddress")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 10, max: 120 }),

  body("username")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 120 }),

  body("password")
    .isString()
    .isLength({ min: 4, max: 255 })
    .withMessage("password is required")
];

const systemTokenValidation = [
  body("serviceName")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 }),

  body("scope")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
];

/**
 * POST /api/v1/auth/login
 */
router.post(
  "/login",
  authRateLimiter,
  loginValidation,
  validateRequest,
  loginHandler
);

/**
 * POST /api/v1/auth/system-token
 */
router.post(
  "/system-token",
  serviceAccess,
  systemTokenValidation,
  validateRequest,
  systemTokenHandler
);

/**
 * GET /api/v1/auth/me
 */
router.get(
  "/me",
  userAccess,
  meHandler
);

module.exports = router;