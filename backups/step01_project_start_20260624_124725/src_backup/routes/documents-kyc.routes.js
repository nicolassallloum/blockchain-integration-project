const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'kyc-documents');

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const safeOriginal = file.originalname
      .replace(/\s+/g, '_')
      .replace(/[^\w.\-]/g, '');

    const uniqueName = `${Date.now()}_${Math.round(Math.random() * 1e9)}_${safeOriginal}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/octet-stream',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error(`File type not allowed: ${file.mimetype}`));
    }

    cb(null, true);
  }
});

function normalizeDate(value) {
  if (!value || String(value).trim() === '') {
    return null;
  }

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [month, day, year] = raw.split('/');
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * GET /api/v1/government-blockchain/documents-kyc
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        resident_id,
        resident_name,
        document_type,
        document_number,
        expiry_date,
        file_name,
        original_file_name,
        file_path,
        mime_type,
        file_size,
        kyc_status,
        rejection_reason,
        uploaded_by,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at
      FROM blockchain.kyc_documents
      ORDER BY created_at DESC, id DESC
    `);

    return res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('[KYC DOCUMENTS LIST ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load KYC documents',
      error: error.message,
      detail: error.detail || null,
      code: error.code || null
    });
  }
});

/**
 * GET /api/v1/government-blockchain/documents-kyc/summary
 */
router.get('/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::INT AS total_documents,
        COUNT(*) FILTER (WHERE kyc_status = 'Verified')::INT AS verified,
        COUNT(*) FILTER (WHERE kyc_status = 'Pending')::INT AS pending,
        COUNT(*) FILTER (WHERE kyc_status IN ('Rejected', 'Expired'))::INT AS rejected
      FROM blockchain.kyc_documents
    `);

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[KYC DOCUMENTS SUMMARY ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load KYC document summary',
      error: error.message,
      detail: error.detail || null,
      code: error.code || null
    });
  }
});

/**
 * POST /api/v1/government-blockchain/documents-kyc/upload
 */
router.post('/upload', (req, res) => {
  upload.single('document')(req, res, async function (multerError) {
    try {
      if (multerError) {
        console.error('[KYC MULTER ERROR]', multerError);

        return res.status(400).json({
          success: false,
          message: 'File upload failed',
          error: multerError.message
        });
      }

      const body = req.body || {};

      console.log('[KYC UPLOAD BODY]', body);
      console.log('[KYC UPLOAD FILE]', req.file);

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Document file is required. Field name must be document.'
        });
      }

      const residentId = body.resident_id;
      const residentName = body.resident_name;
      const documentType = body.document_type;
      const documentNumber = body.document_number || null;
      const expiryDate = normalizeDate(body.expiry_date);
      const uploadedBy = body.uploaded_by || 'Officer';

      if (!residentId || !residentName || !documentType) {
        return res.status(400).json({
          success: false,
          message: 'Resident ID, Resident Name, and Document Type are required.'
        });
      }

      const relativePath = `/uploads/kyc-documents/${req.file.filename}`;

      const result = await pool.query(
        `
        INSERT INTO blockchain.kyc_documents (
          resident_id,
          resident_name,
          document_type,
          document_number,
          expiry_date,
          file_name,
          original_file_name,
          file_path,
          mime_type,
          file_size,
          kyc_status,
          uploaded_by,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          'Pending', $11,
          NOW(), NOW()
        )
        RETURNING *
        `,
        [
          residentId,
          residentName,
          documentType,
          documentNumber,
          expiryDate,
          req.file.filename,
          req.file.originalname,
          relativePath,
          req.file.mimetype,
          req.file.size,
          uploadedBy
        ]
      );

      console.log('[KYC DOCUMENT INSERT SUCCESS]', result.rows[0]);

      return res.status(201).json({
        success: true,
        message: 'KYC document uploaded successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('[KYC DOCUMENT UPLOAD ERROR]', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to upload KYC document',
        error: error.message,
        detail: error.detail || null,
        code: error.code || null
      });
    }
  });
});

/**
 * PATCH /api/v1/government-blockchain/documents-kyc/:id/status
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};

    const newStatus =
      body.kyc_status ||
      body.status ||
      body.document_status;

    const rejectionReason = body.rejection_reason || null;
    const reviewedBy = body.reviewed_by || 'Officer';

    console.log('[KYC STATUS UPDATE]', {
      id,
      body,
      newStatus
    });

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID'
      });
    }

    if (!['Pending', 'Verified', 'Rejected', 'Expired'].includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid KYC status',
        received: newStatus
      });
    }

    const result = await pool.query(
      `
      UPDATE blockchain.kyc_documents
      SET
        kyc_status = $1,
        rejection_reason = $2,
        reviewed_by = $3,
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [newStatus, rejectionReason, reviewedBy, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'KYC document not found'
      });
    }

    return res.json({
      success: true,
      message: 'KYC document status updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[KYC DOCUMENT STATUS UPDATE ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update KYC document status',
      error: error.message,
      detail: error.detail || null,
      code: error.code || null
    });
  }
});

/**
 * GET /api/v1/government-blockchain/documents-kyc/:id/download
 */
router.get('/:id/download', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID'
      });
    }

    const result = await pool.query(
      `
      SELECT file_name, original_file_name
      FROM blockchain.kyc_documents
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const document = result.rows[0];
    const fullPath = path.join(uploadDir, document.file_name);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    return res.download(fullPath, document.original_file_name);
  } catch (error) {
    console.error('[KYC DOCUMENT DOWNLOAD ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to download KYC document',
      error: error.message,
      detail: error.detail || null,
      code: error.code || null
    });
  }
});

module.exports = router;
