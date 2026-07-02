"use strict";

const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const blockchainController = require("../controllers/blockchain.controller");

const router = express.Router();

router.get("/status", asyncHandler(blockchainController.getBlockchainStatus));

router.post(
  "/proof/submit",
  asyncHandler(blockchainController.submitProof)
);

module.exports = router;
