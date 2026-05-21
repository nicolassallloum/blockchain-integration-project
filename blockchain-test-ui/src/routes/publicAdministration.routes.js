// src/routes/publicAdministration.routes.js

const express = require('express');

const {
  createPublicAdministration,
  createPublicAdministrationWallet,
  bulkUploadPublicAdministrations,
  savePublicAdministrationDraft
} = require('../controllers/publicAdministration.controller');

const router = express.Router();

router.post('/', createPublicAdministration);

router.post('/bulk-upload', bulkUploadPublicAdministrations);

router.post('/drafts', savePublicAdministrationDraft);

router.post('/:administrationId/wallet', createPublicAdministrationWallet);

module.exports = router;
