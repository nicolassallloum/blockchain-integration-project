const express = require('express');
const crypto = require('crypto');
const pool = require('../config/database');

const router = express.Router();

function sha256(value) {
  return crypto.createHash('sha256').update(value || '').digest('hex');
}

router.post('/customers', async (req, res) => {
  try {
    const formData = req.body.formData || {};

    const customerName = formData.CUSTOMER_NAME || null;
    const customerType = formData.CUSTOMER_TYPE || null;
    const branchCode = formData.BRANCH || null;
    const tinNumber = formData.TIN_NUMBER || null;
    const vatNumber = formData.VAT_NUMBER || null;

    let selfieFileName = null;
    let selfieHash = null;

    if (formData.UPLOAD_SELFIE) {
      const selfieParts = formData.UPLOAD_SELFIE.split(',');
      selfieFileName = selfieParts[0] || null;
      const selfieBase64 = selfieParts.slice(1).join(',');
      selfieHash = sha256(selfieBase64);
    }

    const blockchainPayload = {
      sourceSystem: 'VALOORES',
      entityType: 'CUSTOMER',
      operationType: 'CREATE_CUSTOMER',
      customer: {
        customerName,
        customerType,
        branch: branchCode,
        tinNumber,
        vatNumber,
        street: formData.STREET || null,
        building: formData.BUILDING || null,
        floor: formData.FLOOR || null,
        comments: formData.COMMENTS || null,
        legalForm: formData.LEGAL_FORM || null,
        taxCountry: formData.TAX_COUNTRY || null,
        isResident: formData.IS_RESIDENT || null
      },
      documents: {
        selfieFileName,
        selfieHash
      }
    };

    const payloadHash = sha256(JSON.stringify(blockchainPayload));

    const insertResult = await pool.query(
      `
      INSERT INTO blockchain.valoores_customer_blockchain_proofs (
        customer_name,
        customer_type,
        branch_code,
        tin_number,
        vat_number,
        customer_payload,
        selfie_file_name,
        selfie_hash,
        blockchain_status,
        blockchain_hash,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
      `,
      [
        customerName,
        customerType,
        branchCode,
        tinNumber,
        vatNumber,
        blockchainPayload,
        selfieFileName,
        selfieHash,
        'SAVED',
        payloadHash,
        'SPRINGBOOT'
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Customer saved on Blockchain successfully',
      data: {
        proofId: insertResult.rows[0].id,
        customerName,
        customerType,
        branchCode,
        tinNumber,
        vatNumber,
        blockchainStatus: 'SAVED',
        blockchainTransactionId: `BC-CUST-${insertResult.rows[0].id}`,
        blockchainHash: payloadHash
      }
    });

  } catch (error) {
    console.error('Create Valoores customer blockchain error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to save customer on Blockchain',
      error: error.message
    });
  }
});

router.get('/customers', async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        source_system,
        entity_type,
        operation_type,
        customer_name,
        customer_type,
        branch_code,
        tin_number,
        vat_number,
        selfie_file_name,
        selfie_hash,
        blockchain_status,
        blockchain_transaction_id,
        blockchain_hash,
        blockchain_error,
        created_by,
        created_at,
        updated_at
      FROM blockchain.valoores_customer_blockchain_proofs
      ORDER BY created_at DESC
      LIMIT 100
      `
    );

    return res.json({
      success: true,
      message: 'Valoores blockchain customers returned successfully',
      data: result.rows
    });

  } catch (error) {
    console.error('Get Valoores customer blockchain proofs error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve Valoores blockchain customers',
      error: error.message
    });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total_customers,
        COUNT(*) FILTER (WHERE blockchain_status = 'SAVED')::int AS saved_customers,
        COUNT(*) FILTER (WHERE blockchain_status = 'PENDING')::int AS pending_customers,
        COUNT(*) FILTER (WHERE blockchain_status = 'FAILED')::int AS failed_customers
      FROM blockchain.valoores_customer_blockchain_proofs
      `
    );

    return res.json({
      success: true,
      message: 'Valoores blockchain dashboard returned successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Get Valoores blockchain dashboard error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve Valoores blockchain dashboard',
      error: error.message
    });
  }
});

module.exports = router;
