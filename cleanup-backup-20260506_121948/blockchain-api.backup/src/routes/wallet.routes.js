'use strict';

const express = require('express');
const router = express.Router();

const walletController = require('../controllers/wallet.controller');

/**
 * STEP 30 / 31 — Wallet Routes
 *
 * IMPORTANT:
 * The list route "/" must come before dynamic routes like "/:walletAddress".
 */

/**
 * List wallets for Angular dashboard.
 *
 * GET /api/v1/wallets?page=1&limit=13&search=
 */
router.get('/', walletController.listWallets);

/**
 * Create wallet.
 *
 * POST /api/v1/wallets
 */
router.post('/', walletController.createWallet);

/**
 * Wallet login.
 *
 * POST /api/v1/wallets/login
 */
router.post('/login', walletController.loginWallet);

/**
 * Get wallet by customer ID.
 *
 * GET /api/v1/wallets/customer/:customerId
 */
router.get('/customer/:customerId', walletController.getWalletByCustomerId);

/**
 * Get wallet by wallet address.
 *
 * GET /api/v1/wallets/:walletAddress
 */
router.get('/:walletAddress', walletController.getWalletByAddress);

module.exports = router;
