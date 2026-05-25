const residentService = require('../services/resident.service');
const pool = require('../db/postgres');
const fabricService = require('../services/fabric.service');
function sendSuccess(res, message, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}
function buildResidentPayload(body) {
    return {
        residentId: body.residentId,
        firstName: body.firstName,
        fatherName: body.fatherName,
        motherName: body.motherName,
        lastName: body.lastName,
        fullName: body.fullName,
        arabicFullName: body.arabicFullName,
        dateOfBirth: body.dateOfBirth,
        gender: body.gender,
        nationality: body.nationality,

        nationalIdNumber: body.nationalIdNumber,
        passportNumber: body.passportNumber || '',
        residencyPermitNumber: body.residencyPermitNumber || '',
        taxNumber: body.taxNumber || '',

        mobileNumber: body.mobileNumber || '',
        email: body.email || '',
        governorate: body.governorate || '',
        district: body.district || '',
        municipality: body.municipality || '',
        address: body.address || '',

        employmentStatus: body.employmentStatus || '',
        occupation: body.occupation || '',
        monthlyIncome: Number(body.monthlyIncome || 0),

        kycStatus: body.kycStatus || 'Draft',
        riskCategory: body.riskCategory || 'Low Risk',

        walletCurrency: body.walletCurrency || 'LBP',
        walletStatus: body.walletStatus || 'Not Created'
    };
}

exports.createResident = async (req, res) => {
    const client = await pool.connect();

    try {
        const resident = buildResidentPayload(req.body);

        if (!resident.residentId || !resident.firstName || !resident.lastName || !resident.nationalIdNumber) {
            return res.status(400).json({
                success: false,
                message: 'residentId, firstName, lastName, and nationalIdNumber are required'
            });
        }

        await client.query('BEGIN');

        const insertResidentSql = `
            INSERT INTO blockchain.residents (
                resident_id,
                first_name,
                father_name,
                mother_name,
                last_name,
                full_name,
                arabic_full_name,
                date_of_birth,
                gender,
                nationality,
                national_id_number,
                passport_number,
                residency_permit_number,
                tax_number,
                mobile_number,
                email,
                governorate,
                district,
                municipality,
                address,
                employment_status,
                occupation,
                monthly_income,
                kyc_status,
                risk_category,
                blockchain_status,
                blockchain_key
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                $21,$22,$23,$24,$25,$26,$27
            )
            ON CONFLICT (resident_id)
            DO UPDATE SET
                first_name = EXCLUDED.first_name,
                father_name = EXCLUDED.father_name,
                mother_name = EXCLUDED.mother_name,
                last_name = EXCLUDED.last_name,
                full_name = EXCLUDED.full_name,
                arabic_full_name = EXCLUDED.arabic_full_name,
                date_of_birth = EXCLUDED.date_of_birth,
                gender = EXCLUDED.gender,
                nationality = EXCLUDED.nationality,
                national_id_number = EXCLUDED.national_id_number,
                passport_number = EXCLUDED.passport_number,
                residency_permit_number = EXCLUDED.residency_permit_number,
                tax_number = EXCLUDED.tax_number,
                mobile_number = EXCLUDED.mobile_number,
                email = EXCLUDED.email,
                governorate = EXCLUDED.governorate,
                district = EXCLUDED.district,
                municipality = EXCLUDED.municipality,
                address = EXCLUDED.address,
                employment_status = EXCLUDED.employment_status,
                occupation = EXCLUDED.occupation,
                monthly_income = EXCLUDED.monthly_income,
                kyc_status = EXCLUDED.kyc_status,
                risk_category = EXCLUDED.risk_category,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;

        const dbResult = await client.query(insertResidentSql, [
            resident.residentId,
            resident.firstName,
            resident.fatherName,
            resident.motherName,
            resident.lastName,
            resident.fullName,
            resident.arabicFullName,
            resident.dateOfBirth,
            resident.gender,
            resident.nationality,
            resident.nationalIdNumber,
            resident.passportNumber,
            resident.residencyPermitNumber,
            resident.taxNumber,
            resident.mobileNumber,
            resident.email,
            resident.governorate,
            resident.district,
            resident.municipality,
            resident.address,
            resident.employmentStatus,
            resident.occupation,
            resident.monthlyIncome,
            resident.kycStatus,
            resident.riskCategory,
            'Not Committed',
            `RESIDENT_${resident.residentId}`
        ]);

        let blockchainResult = null;

        try {
            blockchainResult = await fabricService.submitTransaction(
                'CreateResident',
                JSON.stringify(resident)
            );

            await client.query(
                `
                UPDATE blockchain.residents
                SET blockchain_status = 'Committed',
                    updated_at = CURRENT_TIMESTAMP
                WHERE resident_id = $1
                `,
                [resident.residentId]
            );
        } catch (blockchainError) {
            await client.query(
                `
                INSERT INTO blockchain.resident_audit_logs
                (resident_id, action_type, status, message)
                VALUES ($1, $2, $3, $4)
                `,
                [
                    resident.residentId,
                    'CREATE_RESIDENT_BLOCKCHAIN',
                    'FAILED',
                    blockchainError.message
                ]
            );

            throw blockchainError;
        }

        await client.query(
            `
            INSERT INTO blockchain.resident_audit_logs
            (resident_id, action_type, status, message)
            VALUES ($1, $2, $3, $4)
            `,
            [
                resident.residentId,
                'CREATE_RESIDENT',
                'SUCCESS',
                'Resident saved in PostgreSQL and Blockchain'
            ]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: 'Resident created successfully in PostgreSQL and Blockchain',
            data: {
                resident: dbResult.rows[0],
                blockchain: blockchainResult
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');

        return res.status(500).json({
            success: false,
            message: 'Failed to create resident',
            error: error.message
        });
    } finally {
        client.release();
    }
};

exports.getResident = async (req, res) => {
    try {
        const { residentId } = req.params;

        const dbResult = await pool.query(
            `
            SELECT *
            FROM blockchain.residents
            WHERE resident_id = $1
            `,
            [residentId]
        );

        if (dbResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Resident not found in PostgreSQL'
            });
        }

        let blockchain = null;

        try {
            blockchain = await fabricService.evaluateTransaction(
                'GetResident',
                residentId
            );
        } catch (error) {
            blockchain = {
                error: error.message
            };
        }

        return res.json({
            success: true,
            message: 'Resident found successfully',
            data: {
                postgres: dbResult.rows[0],
                blockchain
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to get resident',
            error: error.message
        });
    }
};

exports.createResidentWallet = async (req, res) => {
    const client = await pool.connect();

    try {
        const { residentId } = req.params;
        const currency = req.body.currency || req.body.walletCurrency || 'LBP';

        await client.query('BEGIN');

        const residentCheck = await client.query(
            `
            SELECT resident_id
            FROM blockchain.residents
            WHERE resident_id = $1
            `,
            [residentId]
        );

        if (residentCheck.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                success: false,
                message: 'Resident not found in PostgreSQL'
            });
        }

        const blockchainWallet = await fabricService.submitTransaction(
            'CreateResidentWallet',
            residentId,
            currency
        );

        const walletObject = typeof blockchainWallet === 'string'
            ? JSON.parse(blockchainWallet)
            : blockchainWallet;

        await client.query(
            `
            INSERT INTO blockchain.resident_wallets (
                resident_id,
                wallet_address,
                wallet_currency,
                wallet_status,
                blockchain_status
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (wallet_address)
            DO UPDATE SET
                wallet_currency = EXCLUDED.wallet_currency,
                wallet_status = EXCLUDED.wallet_status,
                blockchain_status = EXCLUDED.blockchain_status,
                updated_at = CURRENT_TIMESTAMP
            `,
            [
                residentId,
                walletObject.walletAddress,
                walletObject.walletCurrency || currency,
                walletObject.walletStatus || 'Created',
                'Committed'
            ]
        );

        await client.query(
            `
            UPDATE blockchain.residents
            SET updated_at = CURRENT_TIMESTAMP
            WHERE resident_id = $1
            `,
            [residentId]
        );

        await client.query(
            `
            INSERT INTO blockchain.resident_audit_logs
            (resident_id, action_type, status, message)
            VALUES ($1, $2, $3, $4)
            `,
            [
                residentId,
                'CREATE_RESIDENT_WALLET',
                'SUCCESS',
                'Resident wallet created in Blockchain and PostgreSQL'
            ]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: 'Resident wallet created successfully',
            data: walletObject
        });

    } catch (error) {
        await client.query('ROLLBACK');

        return res.status(500).json({
            success: false,
            message: 'Failed to create resident wallet',
            error: error.message
        });
    } finally {
        client.release();
    }
};

exports.submitResidentKYC = async (req, res) => {
    const client = await pool.connect();

    try {
        const { residentId } = req.params;
        const riskCategory = req.body.riskCategory || 'Low Risk';

        await client.query('BEGIN');

        const blockchainResult = await fabricService.submitTransaction(
            'SubmitResidentKYC',
            residentId,
            riskCategory
        );

        await client.query(
            `
            UPDATE blockchain.residents
            SET kyc_status = 'Submitted',
                risk_category = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE resident_id = $1
            `,
            [residentId, riskCategory]
        );

        await client.query(
            `
            INSERT INTO blockchain.resident_audit_logs
            (resident_id, action_type, status, message)
            VALUES ($1, $2, $3, $4)
            `,
            [
                residentId,
                'SUBMIT_RESIDENT_KYC',
                'SUCCESS',
                'Resident KYC submitted in PostgreSQL and Blockchain'
            ]
        );

        await client.query('COMMIT');

        return res.json({
            success: true,
            message: 'Resident KYC submitted successfully',
            data: blockchainResult
        });

    } catch (error) {
        await client.query('ROLLBACK');

        return res.status(500).json({
            success: false,
            message: 'Failed to submit resident KYC',
            error: error.message
        });
    } finally {
        client.release();
    }
};
function sendError(res, error) {
  console.error('[RESIDENT_CONTROLLER_ERROR]', error);

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
}

async function createResident(req, res) {
  try {
    const resident = await residentService.createResident(req.body);

    return sendSuccess(
      res,
      'Resident account created successfully.',
      resident,
      201
    );
  } catch (error) {
    return sendError(res, error);
  }
}

async function saveDraft(req, res) {
  try {
    const draft = await residentService.saveDraft(req.body);

    return sendSuccess(
      res,
      'Resident draft saved successfully.',
      draft,
      201
    );
  } catch (error) {
    return sendError(res, error);
  }
}

async function createWallet(req, res) {
  try {
    const { residentId } = req.params;

    const result = await residentService.createWallet(residentId, req.body || {});

    return sendSuccess(
      res,
      'Resident wallet created successfully.',
      result,
      201
    );
  } catch (error) {
    return sendError(res, error);
  }
}

async function submitKyc(req, res) {
  try {
    const { residentId } = req.params;

    const result = await residentService.submitKyc(residentId, req.body || {});

    return sendSuccess(
      res,
      'Resident KYC submitted successfully.',
      result,
      200
    );
  } catch (error) {
    return sendError(res, error);
  }
}

async function getResidentById(req, res) {
  try {
    const { residentId } = req.params;

    const resident = await residentService.getResidentById(residentId);

    return sendSuccess(
      res,
      'Resident retrieved successfully.',
      resident,
      200
    );
  } catch (error) {
    return sendError(res, error);
  }
}

async function searchResidents(req, res) {
  try {
    const residents = await residentService.searchResidents(req.query || {});

    return sendSuccess(
      res,
      'Residents retrieved successfully.',
      residents,
      200
    );
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  createResident,
  saveDraft,
  createWallet,
  submitKyc,
  getResidentById,
  searchResidents,
};

exports.getResident = async (req, res) => {
  try {
    const { residentId } = req.params;

    const dbResult = await pool.query(
      `
      SELECT *
      FROM blockchain.residents
      WHERE resident_id = $1
      `,
      [residentId]
    );

    if (dbResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Resident not found in PostgreSQL'
      });
    }

    let blockchain = null;

    try {
      blockchain = await fabricService.evaluateTransaction(
        'GetResident',
        residentId
      );
    } catch (error) {
      blockchain = {
        error: error.message
      };
    }

    return res.json({
      success: true,
      message: 'Resident found successfully',
      data: {
        postgres: dbResult.rows[0],
        blockchain
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get resident',
      error: error.message
    });
  }
};

async function syncResidentToBlockchain(req, res) {
  const client = await pool.connect();

  try {
    const { residentId } = req.params;

    await client.query('BEGIN');

    const residentResult = await client.query(
      `
      SELECT *
      FROM blockchain.residents
      WHERE resident_id = $1
      `,
      [residentId]
    );

    if (residentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Resident not found in PostgreSQL.'
      });
    }

    const resident = residentResult.rows[0];

    const residentPayload = {
      residentId: resident.resident_id,
      firstName: resident.first_name,
      fatherName: resident.father_name,
      motherName: resident.mother_name,
      lastName: resident.last_name,
      fullName: resident.full_name,
      arabicFullName: resident.arabic_full_name,
      dateOfBirth: resident.date_of_birth,
      gender: resident.gender,
      nationality: resident.nationality,

      nationalIdNumber: resident.national_id_number,
      passportNumber: resident.passport_number || '',
      residencyPermitNumber: resident.residency_permit_number || '',
      taxNumber: resident.tax_number || '',

      mobileNumber: resident.mobile_number || '',
      email: resident.email || '',
      governorate: resident.governorate || '',
      district: resident.district || '',
      municipality: resident.municipality || '',
      address: resident.address || '',

      employmentStatus: resident.employment_status || '',
      occupation: resident.occupation || '',
      monthlyIncome: Number(resident.monthly_income || 0),

      kycStatus: resident.kyc_status || 'Draft',
      riskCategory: resident.risk_category || 'Low',

      walletAddress: resident.wallet_address || '',
      walletCurrency: resident.wallet_currency || 'LBP',
      walletStatus: resident.wallet_status || 'Not Created'
    };

    let residentFabricResult = null;
    let walletFabricResult = null;
    let kycFabricResult = null;

    try {
      residentFabricResult = await fabricService.submitTransaction(
        'CreateResident',
        [JSON.stringify(residentPayload)]
      );
    } catch (error) {
      if (!String(error.message).includes('already exists')) {
        throw error;
      }

      residentFabricResult = {
        skipped: true,
        reason: error.message
      };
    }

    const walletResult = await client.query(
      `
      SELECT *
      FROM blockchain.resident_wallets
      WHERE resident_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [residentId]
    );

    if (walletResult.rows.length > 0) {
      const wallet = walletResult.rows[0];

      try {
        walletFabricResult = await fabricService.submitTransaction(
          'CreateResidentWallet',
          [
          residentId,
          wallet.wallet_currency || 'LBP'
          ]
        );

        await client.query(
          `
          UPDATE blockchain.resident_wallets
          SET blockchain_status = 'CONFIRMED',
              fabric_tx_id = COALESCE(fabric_tx_id, 'FABRIC_CONFIRMED'),
              updated_at = CURRENT_TIMESTAMP
          WHERE resident_id = $1
          `,
          [residentId]
        );
      } catch (error) {
        if (!String(error.message).includes('already exists')) {
          throw error;
        }

        walletFabricResult = {
          skipped: true,
          reason: error.message
        };
      }
    }

    if (resident.kyc_status && resident.kyc_status !== 'Draft') {
      try {
        kycFabricResult = await fabricService.submitTransaction(
          'SubmitResidentKYC',
          [
            residentId,
            resident.risk_category || 'Low'
          ]
        );
      } catch (error) {
        if (!String(error.message).includes('not found')) {
          throw error;
        }

        kycFabricResult = {
          skipped: true,
          reason: error.message
        };
      }
    }

    await client.query(
      `
      UPDATE blockchain.residents
      SET updated_at = CURRENT_TIMESTAMP
      WHERE resident_id = $1
      `,
      [residentId]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Resident synced to blockchain successfully.',
      data: {
        resident: residentFabricResult,
        wallet: walletFabricResult,
        kyc: kycFabricResult
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');

    return res.status(500).json({
      success: false,
      message: 'Failed to sync resident to blockchain.',
      error: error.message
    });
  } finally {
    client.release();
  }
}

module.exports.syncResidentToBlockchain = syncResidentToBlockchain;
