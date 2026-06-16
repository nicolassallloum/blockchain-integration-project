const express = require('express');
const crypto = require('crypto');
const pool = require('../config/database');
const fabricService = require('../services/fabric.service');

const router = express.Router();


function toSafeJson(value) {
  return JSON.parse(
    JSON.stringify(value, (_, item) =>
      typeof item === 'bigint' ? item.toString() : item
    )
  );
}

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
      const selfieParts = String(formData.UPLOAD_SELFIE).split(',');
      selfieFileName = selfieParts[0] || null;
      const selfieBase64 = selfieParts.slice(1).join(',');
      selfieHash = sha256(selfieBase64);
    }

    const fabricResidentId = `VALOORES-${tinNumber || Date.now()}`;

    const blockchainPayload = {
      sourceSystem: 'VALOORES',
      entityType: 'CUSTOMER',
      operationType: 'CREATE_CUSTOMER',
      ledgerKey: `KYC_${fabricResidentId}`,
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

    const proofId = insertResult.rows[0].id;

    let fabricResult = null;
    let fabricStatus = 'PENDING';
    let fabricTransactionId = null;
    let fabricError = null;

    const nameParts = String(customerName || 'VALOORES CUSTOMER').trim().split(/\s+/);

    const residentPayload = {
      residentId: fabricResidentId,
      firstName: nameParts[0] || 'VALOORES',
      fatherName: '',
      motherName: '',
      lastName: nameParts.slice(1).join(' ') || 'CUSTOMER',
      fullName: customerName || 'VALOORES CUSTOMER',
      arabicFullName: '',
      dateOfBirth: '',
      gender: '',
      nationality: String(formData.TAX_COUNTRY || ''),
      nationalIdNumber: String(tinNumber || ''),
      passportNumber: '',
      residencyPermitNumber: '',
      taxNumber: String(vatNumber || tinNumber || ''),
      mobileNumber: '',
      email: '',
      governorate: '',
      district: '',
      municipality: '',
      address: [
        formData.STREET,
        formData.BUILDING,
        formData.FLOOR
      ].filter(Boolean).join(', '),
      employmentStatus: '',
      occupation: String(customerType || ''),
      monthlyIncome: 0,
      kycStatus: 'Submitted',
      riskCategory: 'LOW',
      walletAddress: '',
      walletCurrency: 'GOV',
      walletStatus: 'Not Created',

      // Extra Valoores fields kept inside Fabric record safely.
      sourceSystem: 'VALOORES',
      sourceEntityType: 'CUSTOMER',
      branchCode: String(branchCode || ''),
      customerType: String(customerType || ''),
      payloadHash,
      selfieFileName,
      selfieHash
    };

    try {
      fabricResult = await fabricService.submitTransaction(
        'CreateResident',
        [JSON.stringify(residentPayload)],
        {
          requestId: `VALOORES-CUSTOMER-${proofId}`,
          correlationId: `VALOORES-${tinNumber || proofId}`,
          sourceSystem: 'VALOORES',
          requestSource: 'SPRINGBOOT',
          createdBy: 'SPRINGBOOT'
        }
      );

      fabricStatus = 'CONFIRMED';
      fabricTransactionId =
        fabricResult?.transactionId ||
        fabricResult?.txId ||
        fabricResult?.commitStatus?.transactionId ||
        null;
    } catch (error) {
      fabricStatus = 'FAILED';
      fabricError = error.message;
      console.error('Valoores customer Fabric submit error:', error);
    }

    await pool.query(
      `
      UPDATE blockchain.valoores_customer_blockchain_proofs
      SET
        blockchain_status = $1,
        blockchain_transaction_id = $2,
        blockchain_error = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      `,
      [
        fabricStatus,
        fabricTransactionId,
        fabricError,
        proofId
      ]
    );

    return res.status(fabricStatus === 'CONFIRMED' ? 201 : 202).json({
      success: fabricStatus === 'CONFIRMED',
      message:
        fabricStatus === 'CONFIRMED'
          ? 'Customer saved on PostgreSQL and Fabric Blockchain successfully'
          : 'Customer saved on PostgreSQL but Fabric Blockchain submit failed',
      data: {
        proofId,
        customerName,
        customerType,
        branchCode,
        tinNumber,
        vatNumber,
        fabricResidentId,
        ledgerKey: `KYC_${fabricResidentId}`,
        blockchainStatus: fabricStatus,
        blockchainTransactionId: fabricTransactionId,
        blockchainHash: payloadHash,
        blockchainError: fabricError,
        fabricResult: fabricResult ? toSafeJson(fabricResult) : null
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
