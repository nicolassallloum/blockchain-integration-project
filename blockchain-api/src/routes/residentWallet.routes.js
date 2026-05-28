const express = require('express');
const router = express.Router();

const residentWalletController = require('../controllers/residentWallet.controller');

router.get('/', residentWalletController.getResidentWallets);

module.exports = router;
