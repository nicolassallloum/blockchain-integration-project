'use strict';

const crypto = require('crypto');
const pool = require('../config/database');

function generateTxId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function normalizeAdministrationPayload(body) {
  const administration = body.administration || body;

  return {
    administrationId: administration.administrationId,
    administrationCode: administration.administrationCode,
    administrationName: administration.administrationName,
    arabicName: administration.arabicName,
    parentMinistry: administration.parentMinistry,
    administrationType: administration.administrationType,
    directorName: administration.directorName,
    contactPerson: administration.contactPerson,
    contactEmail: administration.contactEmail,
    contactMobile: administration.contactMobile,
    country: administration.country,
    governorate: administration.governorate,
    municipality: administration.municipality,
    address: administration.address,
    walletAddress: administration.walletAddress,
    walletCurrency: administration.walletCurrency,
    walletStatus: administration.walletStatus || 'PENDING'
  };
}

function validateAdministration(payload) {
  const requiredFields = [
    'administrationId',
    'administrationCode',
    'administrationName',
    'arabicName',
    'parentMinistry',
    'administrationType',
    'directorName',
    'contactPerson',
    'contactEmail',
    'contactMobile',
    'country',
    'governorate',
    'municipality',
    'address',
    'walletAddress',
    'walletCurrency',
    'walletStatus'
  ];

  return requiredFields.filter((field) => !payload[field]);
}

async function saveAdministrationToPostgres(payload, blockchainTxId) {
  const query = `
    INSERT INTO blockchain.public_administrations (
      administration_id,
      administration_code,
      administration_name,
      arabic_name,
      parent_ministry,
      administration_type,
      director_name,
      contact_person,
      contact_email,
      contact_mobile,
      country,
      governorate,
      municipality,
      address,
      wallet_address,
      wallet_currency,
      wallet_status,
      blockchain_tx_id,
      blockchain_status,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13, $14,
      $15, $16, $17,
      $18, $19,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (administration_id)
    DO UPDATE SET
      administration_code = EXCLUDED.administration_code,
      administration_name = EXCLUDED.administration_name,
      arabic_name = EXCLUDED.arabic_name,
      parent_ministry = EXCLUDED.parent_ministry,
      administration_type = EXCLUDED.administration_type,
      director_name = EXCLUDED.director_name,
      contact_person = EXCLUDED.contact_person,
      contact_email = EXCLUDED.contact_email,
      contact_mobile = EXCLUDED.contact_mobile,
      country = EXCLUDED.country,
      governorate = EXCLUDED.governorate,
      municipality = EXCLUDED.municipality,
      address = EXCLUDED.address,
      wallet_address = EXCLUDED.wallet_address,
      wallet_currency = EXCLUDED.wallet_currency,
      wallet_status = EXCLUDED.wallet_status,
      blockchain_tx_id = EXCLUDED.blockchain_tx_id,
      blockchain_status = EXCLUDED.blockchain_status,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  const values = [
    payload.administrationId,
    payload.administrationCode,
    payload.administrationName,
    payload.arabicName,
    payload.parentMinistry,
    payload.administrationType,
    payload.directorName,
    payload.contactPerson,
    payload.contactEmail,
    payload.contactMobile,
    payload.country,
    payload.governorate,
    payload.municipality,
    payload.address,
    payload.walletAddress,
    payload.walletCurrency,
    payload.walletStatus,
    blockchainTxId,
    'SAVED'
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

async function createPublicAdministration(req, res) {
  try {
    const payload = normalizeAdministrationPayload(req.body);
    const missingFields = validateAdministration(payload);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields.',
        missingFields
      });
    }

    const blockchainTxId = generateTxId('PA-CREATE');

    /*
      TODO NEXT:
      Replace generated blockchainTxId with real Fabric submitTransaction result.

      Example:
      const fabricResult = await fabricService.submitTransaction(
        'CreatePublicAdministration',
        JSON.stringify(payload)
      );
    */

    const postgresRecord = await saveAdministrationToPostgres(payload, blockchainTxId);

    return res.status(201).json({
      success: true,
      message: 'Public administration saved successfully in PostgreSQL. Blockchain integration is prepared.',
      blockchainTxId,
      postgresRecordId: postgresRecord.id,
      data: postgresRecord
    });
  } catch (error) {
    console.error('[CREATE_PUBLIC_ADMINISTRATION_ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create public administration.',
      error: error.message
    });
  }
}

async function createPublicAdministrationWallet(req, res) {
  try {
    const administrationId = req.params.administrationId;
    const wallet = req.body.wallet || req.body;

    if (!administrationId) {
      return res.status(400).json({
        success: false,
        message: 'Administration ID is required.'
      });
    }

    if (!wallet.walletAddress || !wallet.walletCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address and wallet currency are required.'
      });
    }

    const blockchainTxId = generateTxId('PA-WALLET');

    const result = await pool.query(
      `
      UPDATE blockchain.public_administrations
      SET
        wallet_address = $2,
        wallet_currency = $3,
        wallet_status = $4,
        blockchain_tx_id = $5,
        blockchain_status = 'WALLET_CREATED',
        updated_at = CURRENT_TIMESTAMP
      WHERE administration_id = $1
      RETURNING *;
      `,
      [
        administrationId,
        wallet.walletAddress,
        wallet.walletCurrency,
        wallet.walletStatus || 'ACTIVE',
        blockchainTxId
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Public administration not found.'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Public administration wallet saved successfully in PostgreSQL. Blockchain integration is prepared.',
      blockchainTxId,
      postgresRecordId: result.rows[0].id,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[CREATE_PUBLIC_ADMINISTRATION_WALLET_ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create public administration wallet.',
      error: error.message
    });
  }
}

async function bulkUploadPublicAdministrations(req, res) {
  try {
    const rows = req.body.administrations || req.body.rows || [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No public administration records received.'
      });
    }

    const successfulRows = [];
    const failedRows = [];

    for (let index = 0; index < rows.length; index++) {
      const payload = rows[index];
      const missingFields = validateAdministration(payload);

      if (missingFields.length > 0) {
        failedRows.push({
          rowNumber: index + 1,
          administrationId: payload.administrationId || null,
          reason: 'Missing required fields.',
          missingFields
        });

        continue;
      }

      try {
        const blockchainTxId = generateTxId('PA-BULK');

        const postgresRecord = await saveAdministrationToPostgres(
          payload,
          blockchainTxId
        );

        successfulRows.push({
          rowNumber: index + 1,
          administrationId: payload.administrationId,
          administrationCode: payload.administrationCode,
          administrationName: payload.administrationName,
          walletAddress: payload.walletAddress,
          blockchainTxId,
          postgresRecordId: postgresRecord.id,
          status: 'SUCCESS'
        });
      } catch (rowError) {
        failedRows.push({
          rowNumber: index + 1,
          administrationId: payload.administrationId || null,
          reason: rowError.message
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: `${successfulRows.length} public administration record(s) saved successfully in PostgreSQL. Blockchain integration is prepared.`,
      totalRows: rows.length,
      successCount: successfulRows.length,
      failedCount: failedRows.length,
      data: {
        successfulRows,
        failedRows
      }
    });
  } catch (error) {
    console.error('[BULK_UPLOAD_PUBLIC_ADMINISTRATIONS_ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to bulk upload public administrations.',
      error: error.message
    });
  }
}

async function savePublicAdministrationDraft(req, res) {
  try {
    const payload = normalizeAdministrationPayload(req.body);

    return res.status(201).json({
      success: true,
      message: 'Public administration draft received successfully.',
      data: payload
    });
  } catch (error) {
    console.error('[SAVE_PUBLIC_ADMINISTRATION_DRAFT_ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to save public administration draft.',
      error: error.message
    });
  }
}

module.exports = {
  createPublicAdministration,
  createPublicAdministrationWallet,
  bulkUploadPublicAdministrations,
  savePublicAdministrationDraft
};