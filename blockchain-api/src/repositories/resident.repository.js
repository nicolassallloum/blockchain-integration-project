const db = require('../config/database');

async function createResident(payload) {
  const sql = `
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
      wallet_address,
      wallet_currency,
      wallet_status,
      record_status
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29
    )
    RETURNING *;
  `;

  const values = [
    payload.residentId,
    payload.firstName,
    payload.fatherName || null,
    payload.motherName || null,
    payload.lastName,
    payload.fullName,
    payload.arabicFullName || null,
    payload.dateOfBirth || null,
    payload.gender || null,
    payload.nationality || null,
    payload.nationalIdNumber || null,
    payload.passportNumber || null,
    payload.residencyPermitNumber || null,
    payload.taxNumber || null,
    payload.mobileNumber || null,
    payload.email || null,
    payload.governorate || null,
    payload.district || null,
    payload.municipality || null,
    payload.address || null,
    payload.employmentStatus || null,
    payload.occupation || null,
    payload.monthlyIncome || null,
    payload.kycStatus || 'Draft',
    payload.riskCategory || 'Low',
    payload.walletAddress || null,
    'GOV',
    payload.walletStatus || 'Not Created',
    payload.recordStatus || 'ACTIVE',
  ];

  const result = await db.query(sql, values);
  return result.rows[0];
}

async function createOrUpdateDraft(payload) {
  const sql = `
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
      wallet_address,
      wallet_currency,
      wallet_status,
      record_status
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, 'DRAFT'
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
      wallet_address = EXCLUDED.wallet_address,
      wallet_currency = EXCLUDED.wallet_currency,
      wallet_status = EXCLUDED.wallet_status,
      record_status = 'DRAFT',
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  const values = [
    payload.residentId,
    payload.firstName || 'Draft',
    payload.fatherName || null,
    payload.motherName || null,
    payload.lastName || 'Draft',
    payload.fullName || 'Draft Resident',
    payload.arabicFullName || null,
    payload.dateOfBirth || null,
    payload.gender || null,
    payload.nationality || null,
    payload.nationalIdNumber || null,
    payload.passportNumber || null,
    payload.residencyPermitNumber || null,
    payload.taxNumber || null,
    payload.mobileNumber || null,
    payload.email || null,
    payload.governorate || null,
    payload.district || null,
    payload.municipality || null,
    payload.address || null,
    payload.employmentStatus || null,
    payload.occupation || null,
    payload.monthlyIncome || null,
    payload.kycStatus || 'Draft',
    payload.riskCategory || 'Low',
    payload.walletAddress || null,
    'GOV',
    payload.walletStatus || 'Not Created',
  ];

  const result = await db.query(sql, values);
  return result.rows[0];
}

async function findResidentById(residentId) {
  const result = await db.query(
    `
    SELECT *
    FROM blockchain.residents
    WHERE resident_id = $1;
    `,
    [residentId]
  );

  return result.rows[0] || null;
}

async function createWallet(residentId, walletData) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const walletResult = await client.query(
      `
      INSERT INTO blockchain.resident_wallets (
        resident_id,
        wallet_address,
        wallet_currency,
        wallet_status,
        blockchain_status,
        fabric_tx_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
      `,
      [
        residentId,
        walletData.walletAddress,
        'GOV',
        walletData.walletStatus || 'Active',
        walletData.blockchainStatus || 'PENDING',
        walletData.fabricTxId || null,
      ]
    );

    const residentResult = await client.query(
      `
      UPDATE blockchain.residents
      SET
        wallet_address = $2,
        wallet_currency = $3,
        wallet_status = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE resident_id = $1
      RETURNING *;
      `,
      [
        residentId,
        walletData.walletAddress,
        'GOV',
        walletData.walletStatus || 'Active',
      ]
    );

    await client.query('COMMIT');

    return {
      wallet: walletResult.rows[0],
      resident: residentResult.rows[0],
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function submitKyc(residentId, payload) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const kycResult = await client.query(
      `
      INSERT INTO blockchain.resident_kyc (
        resident_id,
        kyc_status,
        risk_category,
        submitted_at
      )
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      RETURNING *;
      `,
      [
        residentId,
        payload.kycStatus || 'Pending Review',
        payload.riskCategory || 'Low',
      ]
    );

    const residentResult = await client.query(
      `
      UPDATE blockchain.residents
      SET
        kyc_status = $2,
        risk_category = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE resident_id = $1
      RETURNING *;
      `,
      [
        residentId,
        payload.kycStatus || 'Pending Review',
        payload.riskCategory || 'Low',
      ]
    );

    await client.query('COMMIT');

    return {
      kyc: kycResult.rows[0],
      resident: residentResult.rows[0],
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function searchResidents(filters = {}) {
  const conditions = [];
  const values = [];

  if (filters.kycStatus) {
    values.push(filters.kycStatus);
    conditions.push(`kyc_status = $${values.length}`);
  }

  if (filters.walletStatus) {
    values.push(filters.walletStatus);
    conditions.push(`wallet_status = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(`
      (
        full_name ILIKE $${values.length}
        OR resident_id ILIKE $${values.length}
        OR national_id_number ILIKE $${values.length}
        OR mobile_number ILIKE $${values.length}
        OR email ILIKE $${values.length}
      )
    `);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(
    `
    SELECT *
    FROM blockchain.residents
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT 200;
    `,
    values
  );

  return result.rows;
}

async function insertAuditLog(payload) {
  await db.query(
    `
    INSERT INTO blockchain.audit_logs (
      module_name,
      action_name,
      action,
      entity_type,
      entity_id,
      request_payload,
      response_payload,
      status,
      error_message
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
    `,
    [
      payload.moduleName,
      payload.actionName,
      payload.actionName,
      payload.entityType || null,
      payload.entityId || null,
      payload.requestPayload || null,
      payload.responsePayload || null,
      payload.status || 'SUCCESS',
      payload.errorMessage || null,
    ]
  );
}

module.exports = {
  createResident,
  createOrUpdateDraft,
  findResidentById,
  createWallet,
  submitKyc,
  searchResidents,
  insertAuditLog,
};
