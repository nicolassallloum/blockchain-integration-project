const express = require('express');

const {
  listSourceViews,
  getSourceView,
  validateSourceViews
} = require('../controllers/blockchain-proof-source-views.controller');

const router = express.Router();

router.get('/', listSourceViews);
router.get('/validate', validateSourceViews);
router.get('/:recordType', getSourceView);

module.exports = router;
