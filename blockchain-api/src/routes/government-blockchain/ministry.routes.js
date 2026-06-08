const express = require('express');
const multer = require('multer');

const {
  getNextMinistryId,
  createMinistryAccount,
  loginMinistry,
  saveMinistryDraft,
  createMinistryWallet,
  getMinistries,
  getMinistryById,
  bulkCreateMinistries
} = require('../../controllers/government-blockchain/ministry.controller');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

router.post('/login', loginMinistry);
router.post('/draft', saveMinistryDraft);
router.post('/bulk', upload.single('file'), bulkCreateMinistries);
router.get('/reference/next-ministry-id', getNextMinistryId);
router.post('/', createMinistryAccount);
router.get('/', getMinistries);

router.post('/:ministryId/wallet', createMinistryWallet);
router.get('/:ministryId', getMinistryById);

module.exports = router;
