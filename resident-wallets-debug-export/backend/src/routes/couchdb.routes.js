const express = require('express');
const couchdbController = require('../controllers/couchdb.controller');

const router = express.Router();

router.get('/status', couchdbController.getStatus);
router.get('/databases', couchdbController.getDatabases);
router.get('/database-counts', couchdbController.getAllDatabaseCounts);

router.get('/:database/info', couchdbController.getDatabaseInfo);
router.get('/:database/documents', couchdbController.getDocuments);
router.get('/:database/counts', couchdbController.getCounts);
router.get('/:database/documents/:documentId', couchdbController.getDocumentById);

module.exports = router;