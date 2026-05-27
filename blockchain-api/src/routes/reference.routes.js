'use strict';

const express = require('express');
const router = express.Router();

const referenceController = require('../controllers/reference.controller');

function requireHandler(name) {
  const handler = referenceController[name];

  if (typeof handler !== 'function') {
    throw new Error(
      `reference.controller.js is missing exported function: ${name}. ` +
      `Available exports: ${Object.keys(referenceController).join(', ')}`
    );
  }

  return handler;
}

/*
|--------------------------------------------------------------------------
| Government Blockchain Reference Routes
|--------------------------------------------------------------------------
*/

router.get('/next-resident-id', requireHandler('getNextResidentId'));

router.get('/governorates', requireHandler('getGovernorates'));

router.get('/districts', requireHandler('getDistricts'));

router.get('/municipalities', requireHandler('getMunicipalities'));

router.get('/kyc-statuses', requireHandler('getKycStatuses'));

router.get('/risk-categories', requireHandler('getRiskCategories'));

router.get('/employment-statuses', requireHandler('getEmploymentStatuses'));

module.exports = router;
