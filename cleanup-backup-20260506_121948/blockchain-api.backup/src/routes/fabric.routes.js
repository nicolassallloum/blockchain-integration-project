"use strict";

/**
 * STEP 28 — Secure Fabric Routes
 */

const express = require("express");
const { body } = require("express-validator");

const fabricController = require("../controllers/fabric.controller");
const apiKeyProtection = require("../middleware/apiKey.middleware");
const { validateRequest } = require("../middleware/validation.middleware");

const router = express.Router();

function unavailableHandler(handlerName) {
  return (req, res) => {
    return res.status(501).json({
      success: false,
      message: `Fabric handler is not implemented: ${handlerName}`,
      errorCode: "FABRIC_HANDLER_NOT_IMPLEMENTED",
      availableHandlers: Object.keys(fabricController),
      requestId: req.requestId || req.headers["x-request-id"] || null
    });
  };
}

const submitHandler =
  fabricController.submitTransaction ||
  fabricController.submit ||
  fabricController.invoke ||
  unavailableHandler("submitTransaction");

const evaluateHandler =
  fabricController.evaluateTransaction ||
  fabricController.evaluate ||
  fabricController.query ||
  unavailableHandler("evaluateTransaction");

const fabricValidation = [
  body("functionName")
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .matches(/^[A-Za-z0-9_]+$/)
    .withMessage("functionName is invalid"),

  body("args")
    .optional()
    .isArray()
    .withMessage("args must be an array")
];

/**
 * POST /api/v1/fabric/submit
 */
router.post(
  "/submit",
  apiKeyProtection,
  fabricValidation,
  validateRequest,
  submitHandler
);

/**
 * POST /api/v1/fabric/evaluate
 */
router.post(
  "/evaluate",
  apiKeyProtection,
  fabricValidation,
  validateRequest,
  evaluateHandler
);

module.exports = router;