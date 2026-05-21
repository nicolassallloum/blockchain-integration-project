const express = require('express');

const {
  createMinistryAccount,
  loginMinistry,
  saveMinistryDraft,
  createMinistryWallet,
  getMinistries,
  getMinistryById
} = require('../../controllers/government-blockchain/ministry.controller');

const router = express.Router();

router.post('/login', loginMinistry);
router.post('/draft', saveMinistryDraft);
router.post('/', createMinistryAccount);
router.post('/:ministryId/wallet', createMinistryWallet);

router.get('/', getMinistries);
router.get('/:ministryId', getMinistryById);

module.exports = router;