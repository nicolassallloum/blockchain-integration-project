"use strict";

const express = require("express");
const fabricController = require("../controllers/fabric.controller");

const router = express.Router();

router.get("/status", fabricController.status.bind(fabricController));

router.post("/evaluate", fabricController.evaluate.bind(fabricController));

router.post("/submit", fabricController.submit.bind(fabricController));

module.exports = router;
