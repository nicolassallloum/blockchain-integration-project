'use strict';

const express = require('express');
const router = express.Router();

const walletController = require('../controllers/wallet.controller');

const {
  userAccess,
  serviceAccess,
  userOrServiceAccess,
  adminAccess
} = require('../middleware/routeSecurity.middleware');

/**
 * STEP 27 — Protected Wallet Routes
 */

/**
 * Create wallet.
 * Usually called by Spring Boot or internal backend service.
 */
router.post(
  '/',
  serviceAccess,
  walletController.createWallet
);

/**
 * Wallet login remains public because it issues a token.
 * If you already use /wallets/login, keep it public.
 */
if (walletController.loginWallet) {
  router.post(
    '/login',
    walletController.loginWallet
  );
}

/**
 * Query wallet by customer ID.
 * User or internal service can access.
 */
if (walletController.getWalletByCustomerId) {
  router.get(
    '/customer/:customerId',
    userOrServiceAccess,
    walletController.getWalletByCustomerId
  );
}

/**
 * Query wallet by wallet address.
 */
if (walletController.getWalletByAddress) {
  router.get(
    '/address/:walletAddress',
    userOrServiceAccess,
    walletController.getWalletByAddress
  );
}

/**
 * Balance query.
 */
if (walletController.getWalletBalance) {
  router.get(
    '/:walletAddress/balance',
    userOrServiceAccess,
    walletController.getWalletBalance
  );
}

/**
 * Admin-only wallet list.
 */
if (walletController.getWallets) {
  router.get(
    '/',
    adminAccess,
    walletController.getWallets
  );
}

module.exports = router;
