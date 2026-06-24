'use strict';

const express = require('express');
const router = express.Router();

const residentController = require('../controllers/resident.controller');

function requireHandler(name) {
  const handler = residentController[name];

  if (typeof handler !== 'function') {
    throw new Error(
      `resident.controller.js is missing exported function: ${name}. ` +
      `Available exports: ${Object.keys(residentController).join(', ')}`
    );
  }

  return handler;
}

/*
|--------------------------------------------------------------------------
| Resident Routes
|--------------------------------------------------------------------------
*/

router.post('/', requireHandler('createResident'));

router.post('/draft', requireHandler('saveDraft'));

router.get('/search', requireHandler('searchResidents'));

/*
|--------------------------------------------------------------------------
| IMPORTANT:
| Static routes must come before /:residentId routes.
|--------------------------------------------------------------------------
*/
router.post('/wallet-login', requireHandler('walletLogin'));

router.get('/:residentId', requireHandler('getResidentById'));

router.post('/:residentId/wallet', requireHandler('createWallet'));

router.post('/:residentId/submit-kyc', requireHandler('submitKyc'));

router.post('/:residentId/sync-blockchain', requireHandler('syncResidentToBlockchain'));

module.exports = router;
