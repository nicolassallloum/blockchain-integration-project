"use strict";

const express = require("express");
const router = express.Router();

const transactionController = require("../controllers/transaction.controller");

const {
  userOrServiceAccess,
  serviceAccess,
  adminAccess
} = require("../middleware/routeSecurity.middleware");

function routeHandler(name) {
  const handler = transactionController[name];

  if (typeof handler === "function") {
    return handler.bind(transactionController);
  }

  return function missingHandler(req, res) {
    return res.status(501).json({
      success: false,
      message: `Transaction controller handler not implemented: ${name}`,
      errorCode: "HANDLER_NOT_IMPLEMENTED",
      data: null,
      requestId: req.requestId || req.headers["x-request-id"] || null
    });
  };
}

router.get(
  "/",
  userOrServiceAccess,
  routeHandler("searchTransactions")
);

router.post(
  "/wallet-transfer",
  userOrServiceAccess,
  routeHandler("walletTransfer")
);

router.post(
  "/organization-transfer",
  serviceAccess,
  routeHandler("organizationTransfer")
);

router.get(
  "/risk/high",
  adminAccess,
  routeHandler("getHighRiskTransactions")
);

router.get(
  "/:transactionId",
  userOrServiceAccess,
  routeHandler("getTransactionById")
);

module.exports = router;