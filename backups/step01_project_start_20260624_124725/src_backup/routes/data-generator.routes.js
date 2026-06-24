'use strict';

const express = require('express');
const router = express.Router();

const dataGeneratorController = require('../controllers/data-generator.controller');

router.post('/run', dataGeneratorController.runDataGenerator);

module.exports = router;
