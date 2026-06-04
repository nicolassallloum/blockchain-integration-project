'use strict';

const express = require('express');
const router = express.Router();

const organizationController = require('../controllers/organization.controller');

router.get('/', organizationController.getOrganizations);

module.exports = router;
