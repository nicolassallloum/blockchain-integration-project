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
    const requestBody = req.body || {};

    const formData =
      requestBody.formData ||
      requestBody.form_data ||
      requestBody.customer_payload?.formData ||
      requestBody.customerPayload?.formData ||
      {};

    const customerId =
      requestBody.customer_id ||
      requestBody.customerId ||
      formData.customer_id ||
      formData.customerId ||
      null;

    const sessionId =
      requestBody.session_id ||
      requestBody.sessionId ||
      formData.session_id ||
      formData.sessionId ||
      null;

    const customerName = formData.CUSTOMER_NAME || null;
    const customerType = formData.CUSTOMER_TYPE || null;
    const branchCode = formData.BRANCH || null;
    // const tinNumber = formData.TIN_NUMBER || null;
    const vatNumber = formData.VAT_NUMBER || null;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'customer_id is required'
      });
    }

    if (!customerName) {
      return res.status(400).json({
        success: false,
        message: 'formData.CUSTOMER_NAME is required'
      });
    }


    let selfieFileName = null;
    let selfieHash = null;

    if (formData.UPLOAD_SELFIE) {
      const selfieParts = String(formData.UPLOAD_SELFIE).split(',');
      selfieFileName = selfieParts[0] || null;
      const selfieBase64 = selfieParts.slice(1).join(',');
      selfieHash = sha256(selfieBase64);
    }

    const fabricResidentId = `VALOORES-${customerId}`;

    const blockchainPayload = {
      sourceSystem: 'VALOORES',
      entityType: 'CUSTOMER',
      operationType: 'CREATE_CUSTOMER',
      ledgerKey: `KYC_${fabricResidentId}`,
      customer: {
        customerName,
        customerId,
        sessionId,
        customerType,
        branch: branchCode,
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
        valoores_customer_id,
        valoores_session_id,
        customer_type,
        branch_code,
        vat_number,
        customer_payload,
        selfie_file_name,
        selfie_hash,
        blockchain_status,
        blockchain_hash,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
      `,
      [
        customerName,
        customerId,
        sessionId,
        customerType,
        branchCode,
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
      nationalIdNumber: '',
      passportNumber: '',
      residencyPermitNumber: '',
      taxNumber: String(vatNumber || ''),
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
          correlationId: `VALOORES-${customerId || proofId}`,
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
        customerId,
        sessionId,
        customerType,
        branchCode,
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
        valoores_customer_id,
        valoores_session_id,
        customer_type,
        branch_code,
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


/**
 * GET /api/v1/valoores-blockchain/kyc-daily-created?month=2026-06
 *
 * Purpose:
 * Display number of KYC records created on a daily basis by selected month.
 */
router.get('/kyc-daily-created', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month format. Use YYYY-MM, example: 2026-06'
      });
    }

    const dateFrom = `${month}-01`;

    const result = await pool.query(
      `
      WITH month_days AS (
        SELECT generate_series(
          date_trunc('month', $1::date),
          date_trunc('month', $1::date) + interval '1 month' - interval '1 day',
          interval '1 day'
        )::date AS kyc_date
      ),
      daily_counts AS (
        SELECT
          created_at::date AS kyc_date,
          COUNT(*)::int AS total_kyc_created,
          COUNT(*) FILTER (WHERE blockchain_status = 'CONFIRMED')::int AS confirmed_kyc,
          COUNT(*) FILTER (WHERE blockchain_status = 'FAILED')::int AS failed_kyc,
          COUNT(*) FILTER (WHERE blockchain_status = 'PENDING')::int AS pending_kyc
        FROM blockchain.valoores_customer_blockchain_proofs
        WHERE created_at >= date_trunc('month', $1::date)
          AND created_at < date_trunc('month', $1::date) + interval '1 month'
        GROUP BY created_at::date
      )
      SELECT
        to_char(md.kyc_date, 'YYYY-MM-DD') AS kyc_date,
        COALESCE(dc.total_kyc_created, 0)::int AS total_kyc_created,
        COALESCE(dc.confirmed_kyc, 0)::int AS confirmed_kyc,
        COALESCE(dc.failed_kyc, 0)::int AS failed_kyc,
        COALESCE(dc.pending_kyc, 0)::int AS pending_kyc
      FROM month_days md
      LEFT JOIN daily_counts dc ON dc.kyc_date = md.kyc_date
      ORDER BY md.kyc_date;
      `,
      [dateFrom]
    );

    const summaryResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total_kyc_created,
        COUNT(*) FILTER (WHERE blockchain_status = 'CONFIRMED')::int AS confirmed_kyc,
        COUNT(*) FILTER (WHERE blockchain_status = 'FAILED')::int AS failed_kyc,
        COUNT(*) FILTER (WHERE blockchain_status = 'PENDING')::int AS pending_kyc
      FROM blockchain.valoores_customer_blockchain_proofs
      WHERE created_at >= date_trunc('month', $1::date)
        AND created_at < date_trunc('month', $1::date) + interval '1 month';
      `,
      [dateFrom]
    );

    return res.status(200).json({
      success: true,
      message: 'KYC daily created report retrieved successfully',
      data: {
        month,
        summary: summaryResult.rows[0],
        daily: result.rows
      }
    });
  } catch (error) {
    console.error('[VALOORES KYC DAILY CREATED ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve KYC daily created report',
      error: error.message
    });
  }
});


module.exports = router;
