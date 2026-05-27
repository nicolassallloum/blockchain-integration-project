'use strict';

const express = require('express');
const router = express.Router();

const controller = require('../controllers/resident-reference.controller');

router.get('/next-resident-id', controller.getNextResidentId);
router.get('/governorates', controller.getGovernorates);
router.get('/districts', controller.getDistricts);
router.get('/municipalities', controller.getMunicipalities);
router.get('/kyc-statuses', controller.getKycStatuses);
router.get('/risk-categories', controller.getRiskCategories);
router.get('/employment-statuses', controller.getEmploymentStatuses);

module.exports = router;
