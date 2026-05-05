'use strict';

/**
 * STEP 27 — Authentication Routes
 */

const express = require('express');

const {
  loginUser,
  issueSystemToken,
  me
} = require('../controllers/auth.controller');

const { validateApiKey } = require('../middleware/apiKey.middleware');
const { validateAnyJwt } = require('../middleware/jwt.middleware');

const router = express.Router();

/**
 * User login.
 */
router.post('/login', loginUser);

/**
 * System token issuing.
 * Requires internal API key.
 */
router.post('/system-token', validateApiKey, issueSystemToken);

/**
 * Current authenticated identity.
 * Accepts either user token or system token.
 */
router.get('/me', validateAnyJwt, me);

module.exports = router;
