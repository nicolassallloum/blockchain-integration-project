'use strict';

const express = require('express');
const router = express.Router();

const {
  createPublicAdministration,
  createPublicAdministrationWallet,
  bulkUploadPublicAdministrations,
  savePublicAdministrationDraft,
  getNextPublicAdministrationCodes
} = require('../controllers/publicAdministration.controller');

router.post('/', createPublicAdministration);
router.get('/next-codes', getNextPublicAdministrationCodes);
router.post('/bulk-upload', bulkUploadPublicAdministrations);
router.post('/drafts', savePublicAdministrationDraft);
router.post('/:administrationId/wallet', createPublicAdministrationWallet);
// router.post('/:administrationId/wallet', getNextPublicAdministrationCodes);

module.exports = router;
