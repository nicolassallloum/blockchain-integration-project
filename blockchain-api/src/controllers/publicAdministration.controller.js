'use strict';

const crypto = require('crypto');
const pool = require('../config/database');
const fabricService = require('../services/fabric.service');

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
    walletCurrency: administration.walletCurrency || 'LBP',
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
    'walletCurrency',
    'walletStatus'
  ];

  return requiredFields.filter((field) => {
    return (
      payload[field] === undefined ||
      payload[field] === null ||
      String(payload[field]).trim() === ''
    );
  });
}

function extractBlockchainData(blockchainResult) {
  let result = blockchainResult;

  if (Buffer.isBuffer(result)) {
    result = result.toString('utf8');
  }

  if (typeof result === 'string') {
    try {
      result = JSON.parse(result);
    } catch {
      result = {};
    }
  }

  const data =
    result?.data?.data ||
    result?.data ||
    result ||
    {};

  const record =
    data.record ||
    data.data?.record ||
    {};

  return {
    raw: result,
    data,
    record,
    txId:
      result?.txId ||
      result?.transactionId ||
      result?.data?.data?.txId ||
      result?.data?.txId ||
      data.txId ||
      record.createdTxId ||
      null,
    walletAddress:
      data.walletAddress ||
      record.walletAddress ||
      null,
    loginUsername:
      data.loginUsername ||
      record.loginUsername ||
      null,
    generatedPassword:
      data.generatedPassword ||
      null,
    walletCurrency:
      data.walletCurrency ||
      record.walletCurrency ||
      null,
    walletStatus:
      data.walletStatus ||
      record.walletStatus ||
      null,
    ledgerReference:
      data.ledgerReference ||
      record.ledgerReference ||
      null
  };
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

async function saveAdministrationToBlockchain(payload, context = {}) {
  const blockchainPayload = {
    ...payload,
    ledgerReference: `PUBLIC_ADMINISTRATION_${payload.administrationId}`
  };

  return fabricService.createPublicAdministration(blockchainPayload, context);
}

async function createPublicAdministration(req, res) {
  try {
    const payload = normalizeAdministrationPayload(req.body);

    /*
      Wallet Address is generated by chaincode.
      UI can send temporary GOV-ADM-1, but backend removes it before blockchain submit.
    */
    delete payload.walletAddress;

    const missingFields = validateAdministration(payload);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields.',
        missingFields
      });
    }

    const blockchainResult = await saveAdministrationToBlockchain(payload, {
      requestId: req.requestId,
      correlationId: req.correlationId,
      sourceSystem: req.sourceSystem,
      requestSource: req.requestSource,
      createdBy: req.body.createdBy || 'system'
    });

    const blockchain = extractBlockchainData(blockchainResult);

    const blockchainTxId =
      blockchain.txId ||
      generateTxId('PA-CREATE');

    payload.walletAddress = blockchain.walletAddress;
    payload.loginUsername =
      blockchain.loginUsername ||
      payload.contactEmail ||
      payload.administrationCode;
    payload.generatedPassword = blockchain.generatedPassword;
    payload.walletCurrency =
      blockchain.walletCurrency ||
      payload.walletCurrency ||
      'LBP';
    payload.walletStatus =
      blockchain.walletStatus ||
      payload.walletStatus ||
      'PENDING';

    if (!payload.walletAddress) {
      return res.status(500).json({
        success: false,
        message: 'Blockchain did not return generated wallet address.',
        blockchainResult
      });
    }

    const postgresRecord = await saveAdministrationToPostgres(
      payload,
      blockchainTxId
    );

    return res.status(201).json({
      success: true,
      message: 'Public administration saved successfully in Blockchain and PostgreSQL.',
      blockchainTxId,
      postgresRecordId: postgresRecord.id,
      loginUsername: payload.loginUsername,
      generatedPassword: payload.generatedPassword,
      walletAddress: payload.walletAddress,
      walletCurrency: payload.walletCurrency,
      walletStatus: payload.walletStatus,
      ledgerReference:
        blockchain.ledgerReference ||
        `PUBLIC_ADMINISTRATION_${payload.administrationId}`,
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
    const payload = normalizeAdministrationPayload(req.body.administration || req.body);

    if (!administrationId) {
      return res.status(400).json({
        success: false,
        message: 'administrationId is required.'
      });
    }

    const walletAddress =
      payload.walletAddress || `GOV-ADM-${String(administrationId).toUpperCase()}`;

    const walletCurrency = payload.walletCurrency || 'LBP';
    const walletStatus = payload.walletStatus || 'ACTIVE';

    const result = await pool.query(
      `
      UPDATE blockchain.public_administrations
      SET
        wallet_address = $1,
        wallet_currency = $2,
        wallet_status = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE administration_id = $4
      RETURNING *
      `,
      [walletAddress, walletCurrency, walletStatus, administrationId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: `Public administration not found in PostgreSQL: ${administrationId}`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Public administration wallet updated successfully in PostgreSQL.',
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
      const payload = {
        ...rows[index]
      };

      delete payload.walletAddress;

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
        const blockchainResult = await saveAdministrationToBlockchain(payload, {
          requestId: req.requestId,
          correlationId: req.correlationId,
          sourceSystem: req.sourceSystem,
          requestSource: req.requestSource,
          createdBy: req.body.createdBy || 'system'
        });

        const blockchain = extractBlockchainData(blockchainResult);

        const blockchainTxId =
          blockchain.txId ||
          generateTxId('PA-BULK');

        payload.walletAddress = blockchain.walletAddress;
        payload.loginUsername =
          blockchain.loginUsername ||
          payload.contactEmail ||
          payload.administrationCode;
        payload.generatedPassword = blockchain.generatedPassword;
        payload.walletCurrency =
          blockchain.walletCurrency ||
          payload.walletCurrency ||
          'LBP';
        payload.walletStatus =
          blockchain.walletStatus ||
          payload.walletStatus ||
          'PENDING';

        if (!payload.walletAddress) {
          throw new Error('Blockchain did not return generated wallet address.');
        }

        const postgresRecord = await saveAdministrationToPostgres(
          payload,
          blockchainTxId
        );

        successfulRows.push({
          rowNumber: index + 1,
          administrationId: payload.administrationId,
          administrationCode: payload.administrationCode,
          administrationName: payload.administrationName,
          loginUsername: payload.loginUsername,
          generatedPassword: payload.generatedPassword,
          walletAddress: payload.walletAddress,
          walletCurrency: payload.walletCurrency,
          walletStatus: payload.walletStatus,
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
      success: failedRows.length === 0,
      message: `${successfulRows.length} public administration record(s) saved successfully in Blockchain and PostgreSQL.`,
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

async function getNextPublicAdministrationCodes(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE(
          MAX(
            NULLIF(
              REGEXP_REPLACE(administration_id, '^ADM-BLOCKCHAIN-', ''),
              ''
            )::INT
          ),
          0
        ) AS last_admin_number
      FROM blockchain.public_administrations
      WHERE administration_id ~ '^ADM-BLOCKCHAIN-[0-9]+$'
    `);

    const lastAdminNumber = Number(result.rows[0]?.last_admin_number || 0);
    const nextNumber = lastAdminNumber + 1;

    return res.status(200).json({
      success: true,
      data: {
        nextNumber,
        administrationId: `ADM-BLOCKCHAIN-${nextNumber}`,
        administrationCode: `ADM-BLOCKCHAIN-${nextNumber}`,
        walletAddress: `GOV-ADM-${nextNumber}`
      }
    });
  } catch (error) {
    console.error('[GET_NEXT_PUBLIC_ADMINISTRATION_CODES_ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to generate next public administration codes.',
      error: error.message
    });
  }
}

module.exports = {
  createPublicAdministration,
  createPublicAdministrationWallet,
  bulkUploadPublicAdministrations,
  savePublicAdministrationDraft,
  getNextPublicAdministrationCodes
};