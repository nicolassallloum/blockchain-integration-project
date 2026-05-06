'use strict';

const express = require('express');
const router = express.Router();

const referenceController = require('../controllers/reference.controller');

router.get('/next-customer-id', referenceController.getNextCustomerId);
router.get('/organizations', referenceController.getOrganizations);
router.get('/countries', referenceController.getCountries);

module.exports = router;