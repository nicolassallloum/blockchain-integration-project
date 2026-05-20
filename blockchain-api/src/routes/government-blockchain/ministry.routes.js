const express = require('express');

const {
  createMinistryAccount,
  saveMinistryDraft,
  createMinistryWallet,
  getMinistries,
  getMinistryById
} = require('../../controllers/government-blockchain/ministry.controller');

const router = express.Router();

router.get('/', getMinistries);
router.get('/:ministryId', getMinistryById);

router.post('/', createMinistryAccount);
router.post('/draft', saveMinistryDraft);
router.post('/:ministryId/wallet', createMinistryWallet);

module.exports = router;
