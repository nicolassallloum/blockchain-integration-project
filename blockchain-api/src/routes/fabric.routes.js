'use strict';

const express = require('express');
const router = express.Router();

const fabricController = require('../controllers/fabric.controller');

const {
  serviceAccess
} = require('../middleware/routeSecurity.middleware');

/**
 * STEP 27 — Protected Fabric Routes
 *
 * Fabric submit/evaluate should not be public.
 * Only trusted internal services should access these endpoints.
 */

router.post(
  '/submit',
  serviceAccess,
  fabricController.submitTransaction
);

router.post(
  '/evaluate',
  serviceAccess,
  fabricController.evaluateTransaction
);

if (fabricController.getBlockchainStatus) {
  router.get(
    '/status',
    fabricController.getBlockchainStatus
  );
}

module.exports = router;