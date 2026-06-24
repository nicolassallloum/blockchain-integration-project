const couchdbService = require('../services/couchdb.service');

async function getStatus(req, res, next) {
  try {
    const data = await couchdbService.getStatus();

    return res.status(200).json({
      success: true,
      message: 'CouchDB connection status retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getDatabases(req, res, next) {
  try {
    const data = await couchdbService.getDatabases();

    return res.status(200).json({
      success: true,
      message: 'CouchDB databases retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getAllDatabaseCounts(req, res, next) {
  try {
    const data = await couchdbService.getAllDatabaseCounts();

    return res.status(200).json({
      success: true,
      message: 'CouchDB database counts retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getDatabaseInfo(req, res, next) {
  try {
    const { database } = req.params;

    const data = await couchdbService.getDatabaseInfo(database);

    return res.status(200).json({
      success: true,
      message: 'CouchDB database information retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getDocuments(req, res, next) {
  try {
    const { database } = req.params;

    const {
      limit = 50,
      skip = 0,
      search = '',
      documentType = '',
      status = '',
    } = req.query;

    const data = await couchdbService.getDocuments(database, {
      limit: Number(limit),
      skip: Number(skip),
      search,
      documentType,
      status,
    });

    return res.status(200).json({
      success: true,
      message: 'CouchDB documents retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getDocumentById(req, res, next) {
  try {
    const { database, documentId } = req.params;

    const data = await couchdbService.getDocumentById(database, documentId);

    return res.status(200).json({
      success: true,
      message: 'CouchDB document retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getCounts(req, res, next) {
  try {
    const { database } = req.params;

    const data = await couchdbService.getCounts(database);

    return res.status(200).json({
      success: true,
      message: 'CouchDB counts retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getStatus,
  getDatabases,
  getAllDatabaseCounts,
  getDatabaseInfo,
  getDocuments,
  getDocumentById,
  getCounts,
};