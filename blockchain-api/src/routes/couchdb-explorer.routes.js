const express = require('express');
const axios = require('axios');

const router = express.Router();

const COUCHDB_URL = (process.env.COUCHDB_URL || 'http://127.0.0.1:5984').replace(/\/+$/, '');
const COUCHDB_USERNAME = process.env.COUCHDB_USERNAME || process.env.COUCHDB_USER || 'admin';
const COUCHDB_PASSWORD = process.env.COUCHDB_PASSWORD || '';
const DEFAULT_CHAINCODE_DB =
  process.env.COUCHDB_CHAINCODE_DB || 'kycchannelnix1_kyc-wallet-chaincode-js';
const COUCHDB_TIMEOUT_MS = Number(process.env.COUCHDB_TIMEOUT_MS || 10000);

const couch = axios.create({
  baseURL: COUCHDB_URL,
  timeout: COUCHDB_TIMEOUT_MS,
  auth: COUCHDB_USERNAME
    ? {
        username: COUCHDB_USERNAME,
        password: COUCHDB_PASSWORD,
      }
    : undefined,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

function clampLimit(value, defaultValue = 100, max = 500) {
  const parsed = Number(value || defaultValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.min(parsed, max);
}

function safeSkip(value) {
  const parsed = Number(value || 0);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function validateDbName(dbName) {
  if (!dbName || typeof dbName !== 'string') {
    const error = new Error('Database name is required');
    error.statusCode = 400;
    throw error;
  }

  if (dbName.includes('/') || dbName.includes('\\')) {
    const error = new Error('Invalid database name');
    error.statusCode = 400;
    throw error;
  }

  return dbName;
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function summarizeDocument(doc = {}) {
  return {
    _id: doc._id || '',
    _rev: doc._rev || '',
    docType: doc.docType || doc.type || '',
    auditId: doc.auditId || doc.audit_id || '',
    blockchainKey: doc.blockchainKey || doc.blockchain_key || '',
    auditEventHash: doc.auditEventHash || doc.audit_event_hash || '',
    changedFieldsHash: doc.changedFieldsHash || doc.changed_fields_hash || '',
    primaryKeyHash: doc.primaryKeyHash || doc.primary_key_hash || '',
    schemaHash: doc.schemaHash || doc.schema_hash || '',
    tableHash: doc.tableHash || doc.table_hash || '',
    txId: doc.txId || doc.tx_id || '',
    submittedBy: doc.submittedBy || doc.submitted_by || '',
    sourceSystem: doc.sourceSystem || doc.source_system || '',
    createdAt: doc.createdAt || doc.created_at || '',
  };
}

function normalizeAllDocsRow(row) {
  const doc = row.doc || {};

  return {
    id: row.id,
    key: row.key,
    value: row.value,
    summary: summarizeDocument(doc),
    doc,
  };
}

function normalizeFindDoc(doc) {
  return {
    id: doc._id,
    key: doc._id,
    value: {
      rev: doc._rev,
    },
    summary: summarizeDocument(doc),
    doc,
  };
}

async function getDatabaseInfo(dbName) {
  const response = await couch.get(`/${encodeURIComponent(dbName)}`);
  return {
    name: dbName,
    doc_count: response.data.doc_count || 0,
    doc_del_count: response.data.doc_del_count || 0,
    update_seq: response.data.update_seq || '',
    compact_running: Boolean(response.data.compact_running),
    partitioned: Boolean(response.data.props && response.data.props.partitioned),
    sizes: response.data.sizes || {},
    disk_size: response.data.disk_size || response.data.sizes?.file || 0,
    data_size: response.data.data_size || response.data.sizes?.active || 0,
  };
}

router.get('/health', async (req, res, next) => {
  try {
    const response = await couch.get('/');

    res.json({
      ok: true,
      couchdb: response.data.couchdb,
      version: response.data.version,
      defaultDatabase: DEFAULT_CHAINCODE_DB,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/databases', async (req, res, next) => {
  try {
    const response = await couch.get('/_all_dbs');
    const dbNames = Array.isArray(response.data) ? response.data : [];

    const databases = await Promise.all(
      dbNames.map(async (name) => {
        try {
          return await getDatabaseInfo(name);
        } catch (error) {
          return {
            name,
            doc_count: 0,
            doc_del_count: 0,
            update_seq: '',
            compact_running: false,
            partitioned: false,
            sizes: {},
            disk_size: 0,
            data_size: 0,
            error: error.response?.data?.reason || error.message,
          };
        }
      })
    );

    res.json({
      defaultDatabase: DEFAULT_CHAINCODE_DB,
      total: databases.length,
      databases,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/databases/:dbName/documents', async (req, res, next) => {
  try {
    const dbName = validateDbName(req.params.dbName);

    const limit = clampLimit(req.query.limit, 100, 500);
    const skip = safeSkip(req.query.skip);

    const search = String(req.query.search || '').trim();
    const docType = String(req.query.docType || '').trim();
    const auditId = String(req.query.auditId || '').trim();

    const hasFilter = Boolean(search || docType || auditId);

    if (!hasFilter) {
      const response = await couch.get(`/${encodeURIComponent(dbName)}/_all_docs`, {
        params: {
          include_docs: true,
          limit,
          skip,
        },
      });

      return res.json({
        database: dbName,
        limit,
        skip,
        total: response.data.total_rows || 0,
        rows: (response.data.rows || []).map(normalizeAllDocsRow),
      });
    }

    const selector = {};

    if (docType) {
      selector.docType = docType;
    }

    if (auditId) {
      selector.auditId = auditId;
    }

    if (search) {
      const safeSearch = escapeRegex(search);

      selector.$or = [
        { _id: { $regex: safeSearch } },
        { auditId: { $regex: safeSearch } },
        { blockchainKey: { $regex: safeSearch } },
        { txId: { $regex: safeSearch } },
        { auditEventHash: { $regex: safeSearch } },
      ];
    }

    const response = await couch.post(`/${encodeURIComponent(dbName)}/_find`, {
      selector,
      limit,
      skip,
    });

    res.json({
      database: dbName,
      limit,
      skip,
      total: null,
      rows: (response.data.docs || []).map(normalizeFindDoc),
      warning:
        'Filtered results use CouchDB Mango selector. Total count is returned as null for filtered searches.',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/databases/:dbName/documents/:docId', async (req, res, next) => {
  try {
    const dbName = validateDbName(req.params.dbName);
    const docId = req.params.docId;

    if (!docId) {
      return res.status(400).json({
        message: 'Document ID is required',
      });
    }

    const response = await couch.get(
      `/${encodeURIComponent(dbName)}/${encodeURIComponent(docId)}`
    );

    res.json({
      database: dbName,
      id: docId,
      summary: summarizeDocument(response.data),
      doc: response.data,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/databases/:dbName/changes', async (req, res, next) => {
  try {
    const dbName = validateDbName(req.params.dbName);
    const limit = clampLimit(req.query.limit, 50, 200);

    const response = await couch.get(`/${encodeURIComponent(dbName)}/_changes`, {
      params: {
        include_docs: true,
        limit,
        descending: true,
      },
    });

    res.json({
      database: dbName,
      limit,
      last_seq: response.data.last_seq,
      pending: response.data.pending,
      results: response.data.results || [],
    });
  } catch (error) {
    next(error);
  }
});

router.use((error, req, res, next) => {
  const statusCode = error.statusCode || error.response?.status || 500;

  res.status(statusCode).json({
    message: error.response?.data?.reason || error.message || 'CouchDB explorer error',
    error: error.response?.data || null,
  });
});

module.exports = router;
