'use strict';

const pool = require('../config/database');
const fabricService = require('../services/fabric.service');

function generateTransactionReference() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const timestamp = Date.now();
  return `GOV-TXN-${y}${m}${d}-${timestamp}`;
}

function extractBlockchainResult(blockchainResult) {
  const data =
    blockchainResult?.data?.data ||
    blockchainResult?.data ||
    blockchainResult ||
    {};

  return {
    txId:
      blockchainResult?.txId ||
      blockchainResult?.transactionId ||
      data?.txId ||
      data?.transactionId ||
      null,
    data
  };
}

async function getResidentsForDropdown(req, res) {
  try {
    const result = await pool.query(`
      SELECT
          id AS value,
          CONCAT(
            COALESCE(resident_id, id::text),
            ' — ',
            COALESCE(full_name, CONCAT_WS(' ', first_name, father_name, last_name))
          ) AS label,
          id,
          resident_id,
          COALESCE(full_name, CONCAT_WS(' ', first_name, father_name, last_name)) AS full_name,
          wallet_address,
          wallet_currency,
          wallet_status
      FROM blockchain.residents
      ORDER BY id
    `);

    return res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[RESIDENTS_DROPDOWN_ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load residents dropdown.',
      error: error.message
    });
  }
}

async function createGovernmentTransaction(req, res) {
  const client = await pool.connect();
  let dbTransactionId = null;

  try {
    const payload = req.body?.transaction || req.body || {};

    if (!payload.residentId) {
      return res.status(400).json({
        success: false,
        message: 'residentId is required.'
      });
    }

    if (!payload.ministryName) {
      return res.status(400).json({
        success: false,
        message: 'ministryName is required.'
      });
    }

    if (!payload.serviceName) {
      return res.status(400).json({
        success: false,
        message: 'serviceName is required.'
      });
    }

    const residentResult = await client.query(
      `
      SELECT
          id,
          resident_id,
          COALESCE(full_name, CONCAT_WS(' ', first_name, father_name, last_name)) AS full_name,
          wallet_address,
          wallet_currency,
          wallet_status
      FROM blockchain.residents
      WHERE id = $1
      `,
      [payload.residentId]
    );

    if (residentResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Resident not found.'
      });
    }

    const resident = residentResult.rows[0];

    const transactionReference =
      payload.transactionReference || generateTransactionReference();

    const totalFee = Number(payload.totalFee || payload.total_fee || 0);
    const currency = payload.currency || resident.wallet_currency || 'LBP';

    await client.query('BEGIN');

    const insertResult = await client.query(
      `
      INSERT INTO blockchain.government_transactions (
          transaction_reference,
          resident_id,
          resident_db_id,
          resident_name,
          resident_wallet_address,
          ministry_name,
          service_name,
          service_code,
          total_fee,
          currency,
          digital_stamp_required,
          uploaded_documents_count,
          transaction_status,
          blockchain_status,
          created_at,
          updated_at
      )
      VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          NOW(), NOW()
      )
      RETURNING *
      `,
      [
        transactionReference,
        resident.resident_id,
        resident.id,
        resident.full_name,
        resident.wallet_address,
        payload.ministryName,
        payload.serviceName,
        payload.serviceCode || null,
        totalFee,
        currency,
        payload.digitalStampRequired ?? true,
        payload.uploadedDocumentsCount || 0,
        'SUBMITTED',
        'PENDING'
      ]
    );

    const dbRecord = insertResult.rows[0];
    dbTransactionId = dbRecord.id;

    await client.query('COMMIT');

    const blockchainPayload = {
      transactionReference,
      residentDbId: resident.id,
      residentId: resident.resident_id,
      residentName: resident.full_name,
      residentWalletAddress: resident.wallet_address,
      ministryName: payload.ministryName,
      serviceName: payload.serviceName,
      serviceCode: payload.serviceCode || null,
      totalFee,
      currency,
      digitalStampRequired: payload.digitalStampRequired ?? true,
      uploadedDocumentsCount: payload.uploadedDocumentsCount || 0,
      transactionStatus: 'SUBMITTED',
      createdAt: new Date().toISOString()
    };

    const blockchainResult = await fabricService.submitTransaction(
      'CreateGovernmentTransaction',
      [JSON.stringify(blockchainPayload)],
      {
        sourceSystem: 'BLOCKCHAIN_API',
        requestSource: 'NEW_GOVERNMENT_TRANSACTION_SCREEN',
        createdBy: 'system'
      }
    );

    const blockchain = extractBlockchainResult(blockchainResult);

    const updateResult = await pool.query(
      `
      UPDATE blockchain.government_transactions
      SET
          blockchain_status = 'SYNCED',
          blockchain_tx_id = $1,
          blockchain_error = NULL,
          blockchain_submitted_at = NOW(),
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [blockchain.txId, dbTransactionId]
    );

    return res.status(201).json({
      success: true,
      message: 'Government transaction saved successfully in PostgreSQL and Blockchain.',
      transactionReference,
      postgresRecordId: dbTransactionId,
      blockchainTxId: blockchain.txId,
      data: updateResult.rows[0],
      blockchainData: blockchain.data
    });
  } catch (error) {
    console.error('[CREATE_GOVERNMENT_TRANSACTION_ERROR]', error);

    if (dbTransactionId) {
      await pool.query(
        `
        UPDATE blockchain.government_transactions
        SET
            blockchain_status = 'FAILED',
            blockchain_error = $1,
            updated_at = NOW()
        WHERE id = $2
        `,
        [error.message, dbTransactionId]
      );
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create government transaction.',
      error: error.message
    });
  } finally {
    client.release();
  }
}

module.exports = {
  getResidentsForDropdown,
  createGovernmentTransaction
};