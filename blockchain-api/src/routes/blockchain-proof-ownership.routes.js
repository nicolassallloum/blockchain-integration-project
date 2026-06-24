const express = require('express');

const {
  getOwnership,
  getOwnershipByArea,
  validateOwnership
} = require('../controllers/blockchain-proof-ownership.controller');

const router = express.Router();

router.get('/', getOwnership);
router.get('/validate', validateOwnership);
router.get('/:area', getOwnershipByArea);

module.exports = router;
