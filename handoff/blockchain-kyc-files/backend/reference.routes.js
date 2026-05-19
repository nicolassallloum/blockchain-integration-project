'use strict';

const express = require('express');
const router = express.Router();

const referenceController = require('../controllers/reference.controller');

/**
 * Existing routes
 */
router.get('/countries', referenceController.getCountries);
router.get('/debug-test', (req, res) => {
  res.json({
    success: true,
    message: 'Reference route file is loaded'
  });
});
/**
 * Organization reference routes
 * Add aliases to support both old and new frontend names.
 */
router.get('/organization-types', referenceController.getOrganizationTypes);
router.get('/blockchain-organization-types', referenceController.getOrganizationTypes);

router.get('/organizations', referenceController.getOrganizations);
router.get('/blockchain-organizations', referenceController.getOrganizations);

/**
 * New Blockchain KYC reference routes
 */
router.get('/next-customer-id', referenceController.getNextCustomerId);
router.get('/source-of-funds', referenceController.getSourceOfFunds);
router.get('/occupations', referenceController.getOccupations);
router.get('/economic-sectors', referenceController.getEconomicSectors);

module.exports = router;
