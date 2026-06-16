// routes/valoores-blockchain.routes.js

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
        'PENDING',
        payloadHash,
        'SPRINGBOOT'
      ]
    );

    /*
      Here you call Fabric blockchain function.
      Example:
      await fabricService.createCustomer(blockchainPayload);
    */

    await pool.query(
      `
      UPDATE blockchain.valoores_customer_blockchain_proofs
      SET blockchain_status = 'SAVED',
          blockchain_transaction_id = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [
        `BC-CUST-${insertResult.rows[0].id}`,
        insertResult.rows[0].id
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

module.exports = router;