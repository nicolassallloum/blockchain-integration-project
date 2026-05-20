const express = require('express');

const {
  getCountries,
  getGovernorates,
  getWalletTypes,
  getWalletStatuses
} = require('../../controllers/government-blockchain/reference.controller');

const router = express.Router();

router.get('/countries', getCountries);
router.get('/governorates', getGovernorates);
router.get('/wallet-types', getWalletTypes);
router.get('/wallet-statuses', getWalletStatuses);

module.exports = router;
