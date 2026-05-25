const axios = require('axios');
const couchdbConfig = require('../config/couchdb.config');

const couchClient = axios.create({
  baseURL: couchdbConfig.url,
  auth: {
    username: couchdbConfig.username,
    password: couchdbConfig.password,
  },
  timeout: 20000,
  headers: {
    Accept: 'application/json',
  },
});
couchClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[COUCHDB ERROR]', {
      url: error?.config?.url,
      method: error?.config?.method,
      status: error?.response?.status,
      message: error?.message,
      couchdbUrl: couchdbConfig.url,
      couchdbUsername: couchdbConfig.username,
      passwordLoaded: Boolean(couchdbConfig.password),
    });

    throw error;
  }
);
function isSystemDatabase(databaseName) {
  return (
    databaseName === '_replicator' ||
    databaseName === '_users' ||
    databaseName === 'fabric__internal'
  );
}

function extractDocType(doc) {
  return (
    doc.docType ||
    doc.type ||
    doc.objectType ||
    doc.recordType ||
    doc.documentType ||
    doc.assetType ||
    'UNKNOWN'
  );
}

function extractStatus(doc) {
  return (
    doc.status ||
    doc.blockchainStatus ||
    doc.transactionStatus ||
    doc.walletStatus ||
    doc.institutionStatus ||
    doc.approvalStatus ||
    'UNKNOWN'
  );
}

function extractCreatedAt(doc) {
  return (
    doc.createdAt ||
    doc.created_at ||
    doc.timestamp ||
    doc.txTimestamp ||
    doc.createdDate ||
    doc.createdOn ||
    'N/A'
  );
}

async function getStatus() {
  const response = await couchClient.get('/');

  return {
    connected: true,
    couchdb: response.data.couchdb,
    version: response.data.version,
    vendor: response.data.vendor || null,
  };
}

async function getDatabases() {
  const response = await couchClient.get('/_all_dbs');

  const databases = response.data.filter((db) => !isSystemDatabase(db));

  return databases;
}

async function getDatabaseInfo(database) {
  const response = await couchClient.get(`/${encodeURIComponent(database)}`);

  return response.data;
}

async function getDocuments(database, options = {}) {
  const {
    limit = 50,
    skip = 0,
    search = '',
    documentType = '',
    status = '',
  } = options;

  const response = await couchClient.get(`/${encodeURIComponent(database)}/_all_docs`, {
    params: {
      include_docs: true,
      limit,
      skip,
    },
  });

  let documents = response.data.rows
    .filter((row) => row.doc)
    .map((row) => {
      const doc = row.doc;

      return {
        ...doc,
        _ui_docType: extractDocType(doc),
        _ui_status: extractStatus(doc),
        _ui_createdAt: extractCreatedAt(doc),
      };
    });

  if (search) {
    const searchValue = search.toLowerCase();

    documents = documents.filter((doc) =>
      JSON.stringify(doc).toLowerCase().includes(searchValue)
    );
  }

  if (documentType) {
    const documentTypeValue = documentType.toLowerCase();

    documents = documents.filter((doc) =>
      String(doc._ui_docType).toLowerCase().includes(documentTypeValue)
    );
  }

  if (status) {
    const statusValue = status.toLowerCase();

    documents = documents.filter((doc) =>
      String(doc._ui_status).toLowerCase().includes(statusValue)
    );
  }

  return {
    database,
    totalRows: response.data.total_rows,
    offset: response.data.offset,
    limit: Number(limit),
    skip: Number(skip),
    returned: documents.length,
    documents,
  };
}

async function getDocumentById(database, documentId) {
  const response = await couchClient.get(
    `/${encodeURIComponent(database)}/${encodeURIComponent(documentId)}`
  );

  return response.data;
}

async function getCounts(database) {
  const response = await couchClient.get(`/${encodeURIComponent(database)}/_all_docs`, {
    params: {
      include_docs: true,
    },
  });

  const docs = response.data.rows
    .filter((row) => row.doc)
    .map((row) => row.doc);

  const counts = {
    database,
    totalRecords: docs.length,
    byDocType: {},
    byStatus: {},
    byCreatedDate: {},
  };

  docs.forEach((doc) => {
    const docType = extractDocType(doc);
    const status = extractStatus(doc);
    const createdAt = extractCreatedAt(doc);

    counts.byDocType[docType] = (counts.byDocType[docType] || 0) + 1;
    counts.byStatus[status] = (counts.byStatus[status] || 0) + 1;

    if (createdAt && createdAt !== 'N/A') {
      const dateOnly = String(createdAt).substring(0, 10);
      counts.byCreatedDate[dateOnly] = (counts.byCreatedDate[dateOnly] || 0) + 1;
    }
  });

  return counts;
}

async function getAllDatabaseCounts() {
  const databases = await getDatabases();

  const results = [];

  for (const database of databases) {
    try {
      const info = await getDatabaseInfo(database);

      results.push({
        database,
        documentCount: info.doc_count || 0,
        deletedDocuments: info.doc_del_count || 0,
        updateSequence: info.update_seq || null,
        diskSize: info.sizes?.file || info.disk_size || 0,
      });
    } catch (error) {
      results.push({
        database,
        documentCount: 0,
        deletedDocuments: 0,
        updateSequence: null,
        diskSize: 0,
        error: error.message,
      });
    }
  }

  return results;
}

module.exports = {
  getStatus,
  getDatabases,
  getDatabaseInfo,
  getDocuments,
  getDocumentById,
  getCounts,
  getAllDatabaseCounts,
};