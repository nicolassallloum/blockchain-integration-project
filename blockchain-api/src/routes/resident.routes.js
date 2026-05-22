const express = require('express');
const residentController = require('../controllers/resident.controller');

const router = express.Router();

router.post('/', residentController.createResident);

router.post('/drafts', residentController.saveDraft);

router.get('/', residentController.searchResidents);

router.get('/:residentId', residentController.getResidentById);

router.post('/:residentId/wallet', residentController.createWallet);

router.post('/:residentId/kyc/submit', residentController.submitKyc);

module.exports = router;
