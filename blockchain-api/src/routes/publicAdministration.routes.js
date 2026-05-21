'use strict';

const express = require('express');
const router = express.Router();

const {
  createPublicAdministration,
  createPublicAdministrationWallet,
  bulkUploadPublicAdministrations,
  savePublicAdministrationDraft
} = require('../controllers/publicAdministration.controller');

router.post('/', createPublicAdministration);
router.post('/bulk-upload', bulkUploadPublicAdministrations);
router.post('/drafts', savePublicAdministrationDraft);
router.post('/:administrationId/wallet', createPublicAdministrationWallet);

module.exports = router;
