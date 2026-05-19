const express = require('express');
const router = express.Router();

const blockchainKycController = require('../controllers/blockchain-kyc.controller');
const { uploadKycFiles } = require('../middlewares/upload.middleware');

router.post(
  '/blockchain-wallet',
  uploadKycFiles,
  blockchainKycController.createBlockchainKycWallet
);

module.exports = router;
