const express = require('express');

const {
  createMinistryAccount,
  loginMinistry,
  saveMinistryDraft,
  createMinistryWallet,
  getMinistries,
  getMinistryById,
  bulkCreateMinistries
} = require('../../controllers/government-blockchain/ministry.controller');

const router = express.Router();

router.post('/login', loginMinistry);
router.post('/draft', saveMinistryDraft);
router.post('/bulk', bulkCreateMinistries);

router.post('/', createMinistryAccount);
router.get('/', getMinistries);

router.post('/:ministryId/wallet', createMinistryWallet);
router.get('/:ministryId', getMinistryById);

module.exports = router;