'use strict';

const express = require('express');

const {
  getOrganizationTypes,
  getNextCustomerId,
  getSourceOfFunds,
  getOccupations,
  getEconomicSectors,
  getOrganizations,
  getCountries,
  getMinistryDropdowns,
  getGovernoratesByCountry
} = require('../controllers/reference.controller');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Existing Reference APIs
|--------------------------------------------------------------------------
*/

router.get('/organization-types', getOrganizationTypes);
router.get('/next-customer-id', getNextCustomerId);
router.get('/source-of-funds', getSourceOfFunds);
router.get('/occupations', getOccupations);
router.get('/economic-sectors', getEconomicSectors);
router.get('/organizations', getOrganizations);
router.get('/countries', getCountries);

/*
|--------------------------------------------------------------------------
| Government Blockchain / Ministry Dropdown APIs
|--------------------------------------------------------------------------
| Used by:
| Create Ministry Account screen
|--------------------------------------------------------------------------
*/

router.get('/ministry-dropdowns', getMinistryDropdowns);
router.get('/governorates', getGovernoratesByCountry);

module.exports = router;