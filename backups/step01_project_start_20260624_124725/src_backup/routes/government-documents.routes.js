const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const router = express.Router();

let pool;
try {
  pool = require('../config/database');
} catch (error) {
  try {
    pool = require('../config/db');
  } catch (error2) {
    console.error('[GOVERNMENT_DOCUMENTS_DB_CONFIG_ERROR]', error2.message);
    throw error2;
  }
}

const uploadDir = path.join(process.cwd(), 'uploads', 'kyc-documents');
fs.mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream'
];

function cleanText(value) {
  return String(value || '').trim();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBigIntOrNull(value) {
  const cleanValue = cleanText(value);

  if (!cleanValue) {
    return null;
  }

  if (/^\d+$/.test(cleanValue)) {
    return cleanValue;
  }

  return null;
}

function normalizeDate(value) {
  const cleanValue = cleanText(value);

  if (!cleanValue) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanValue)) {
    return cleanValue;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanValue)) {
    const [month, day, year] = cleanValue.split('/');
    return `${year}-${month}-${day}`;
  }

  return null;
}

function normalizeStatus(value) {
  const cleanValue = cleanText(value);

  if (!cleanValue) {
    return 'Pending Review';
  }

  const normalized = cleanValue.toUpperCase().replace(/_/g, ' ');

  if (normalized === 'UPLOADED') {
    return 'Uploaded';
  }

  if (normalized === 'PENDING REVIEW' || normalized === 'PENDING') {
    return 'Pending Review';
  }

  return 'Pending Review';
}

function safeFileName(originalName) {
  return cleanText(originalName)
    .replace(/\s+/g, '_')
    .replace(/[^\w.\-]/g, '');
}

function generateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    const uniqueName = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}_${safeFileName(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024
  },
  fileFilter: function (_req, file, cb) {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error(`Invalid file type: ${file.mimetype}`));
    }

    cb(null, true);
  }
});

function uploadSingleDocument(req, res, next) {
  const middleware = upload.fields([
    { name: 'document', maxCount: 1 },
    { name: 'document_file', maxCount: 1 }
  ]);

  middleware(req, res, function (error) {
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'File upload failed.',
        error: error.message
      });
    }

    next();
  });
}

function getUploadedFile(req) {
  return (
    req.files?.document?.[0] ||
    req.files?.document_file?.[0] ||
    null
  );
}

/**
 * POST /api/v1/government-blockchain/documents/upload
 */
router.post('/upload', uploadSingleDocument, async (req, res) => {
  const uploadedFile = getUploadedFile(req);

  try {
    const body = req.body || {};

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: 'Document file is required. Use field name document or document_file.'
      });
    }

    const transactionInput = cleanText(body.transaction_id || body.transactionId || body.transaction_reference || body.transactionReference);
    const transactionId = toBigIntOrNull(transactionInput);
    const transactionReference = transactionInput || null;
    const residentId = cleanText(body.resident_id || body.residentId);
    const residentName = cleanText(body.resident_name || body.residentName);
    const totalFees = toNumber(body.total_fees || body.totalFees, 0);
    const currency = 'GOV';
    const documentType = cleanText(body.document_type || body.documentType);
    const documentNumber = cleanText(body.document_number || body.documentNumber);
    const expiryDate = normalizeDate(body.expiry_date || body.expiryDate);
    const uploadedBy = cleanText(body.uploaded_by || body.uploadedBy || 'Officer');
    const status = normalizeStatus(body.status);

    if (!residentId || !residentName || !documentType || !documentNumber) {
      return res.status(400).json({
        success: false,
        message: 'Resident ID, Resident Name, Document Type, and Document Number are required.',
        required_fields: [
          'resident_id',
          'resident_name',
          'document_type',
          'document_number',
          'document or document_file'
        ]
      });
    }

    const documentHash = generateFileHash(uploadedFile.path);
    const relativePath = `/uploads/kyc-documents/${uploadedFile.filename}`;

    const insertResult = await pool.query(
      `
      INSERT INTO blockchain.transaction_documents (
        transaction_id,
        transaction_reference,
        resident_id,
        resident_name,
        total_fees,
        currency,
        document_type,
        document_number,
        expiry_date,
        original_file_name,
        stored_file_name,
        file_path,
        mime_type,
        file_size,
        document_hash,
        status,
        uploaded_by,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15,
        $16, $17,
        NOW(), NOW()
      )
      RETURNING *
      `,
      [
        transactionId,
        transactionReference,
        residentId,
        residentName,
        totalFees,
        currency,
        documentType,
        documentNumber,
        expiryDate,
        uploadedFile.originalname,
        uploadedFile.filename,
        relativePath,
        uploadedFile.mimetype,
        uploadedFile.size,
        documentHash,
        status,
        uploadedBy
      ]
    );

    if (transactionReference) {
      await pool.query(
        `
        UPDATE blockchain.government_transactions
        SET
          document_hash = $1,
          uploaded_documents_count = COALESCE(uploaded_documents_count, 0) + 1,
          updated_at = NOW()
        WHERE transaction_reference = $2
           OR transaction_id::text = $2
        `,
        [documentHash, transactionReference]
      );
    }

    return res.status(201).json({
      success: true,
      message: 'KYC document uploaded successfully.',
      data: insertResult.rows[0]
    });
  } catch (error) {
    if (uploadedFile?.path && fs.existsSync(uploadedFile.path)) {
      fs.unlinkSync(uploadedFile.path);
    }

    console.error('[GOVERNMENT_DOCUMENT_UPLOAD_ERROR]', {
      message: error.message,
      detail: error.detail,
      code: error.code,
      table: error.table,
      column: error.column,
      constraint: error.constraint
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to upload KYC document.',
      error: error.message,
      detail: error.detail || null,
      code: error.code || null,
      table: error.table || null,
      column: error.column || null,
      constraint: error.constraint || null
    });
  }
});

/**
 * GET /api/v1/government-blockchain/documents/transaction/:transactionId
 */
router.get('/transaction/:transactionId', async (req, res) => {
  try {
    const transactionId = cleanText(req.params.transactionId);

    const result = await pool.query(
      `
      SELECT *
      FROM blockchain.transaction_documents
      WHERE transaction_id::text = $1
         OR transaction_reference = $1
      ORDER BY created_at DESC, id DESC
      `,
      [transactionId]
    );

    return res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('[GOVERNMENT_DOCUMENTS_BY_TRANSACTION_ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to get transaction documents.',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/government-blockchain/documents/resident/:residentId
 */
router.get('/resident/:residentId', async (req, res) => {
  try {
    const residentId = cleanText(req.params.residentId);

    const result = await pool.query(
      `
      SELECT *
      FROM blockchain.transaction_documents
      WHERE resident_id = $1
      ORDER BY created_at DESC, id DESC
      `,
      [residentId]
    );

    return res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('[GOVERNMENT_DOCUMENTS_BY_RESIDENT_ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to get resident documents.',
      error: error.message
    });
  }
});

module.exports = router;
