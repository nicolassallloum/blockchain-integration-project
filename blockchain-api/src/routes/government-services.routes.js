const express = require('express');
const router = express.Router();
const pool = require('../config/database');

function normalizeStatus(status) {
  const value = String(status || 'DRAFT').toUpperCase();

  if (!['ACTIVE', 'INACTIVE', 'DRAFT'].includes(value)) {
    return 'DRAFT';
  }

  return value;
}

function normalizeBoolean(value) {
  return (
    value === true ||
    value === 'true' ||
    value === 'TRUE' ||
    value === 'YES' ||
    value === 'Yes' ||
    value === 'yes' ||
    value === '1' ||
    value === 1
  );
}

async function resolveCategoryId(categoryValue) {
  if (!categoryValue) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT category_id
    FROM blockchain.government_service_categories
    WHERE category_id::TEXT = $1
       OR UPPER(category_code) = UPPER($1)
       OR UPPER(category_name) = UPPER($1)
    LIMIT 1
    `,
    [String(categoryValue).trim()]
  );

  return result.rows[0]?.category_id || null;
}

async function resolveMinistryId(ministryValue) {
  if (!ministryValue || ministryValue === 'Not Assigned') {
    return null;
  }

  const result = await pool.query(
    `
    SELECT ministry_id
    FROM blockchain.government_ministries
    WHERE ministry_id::TEXT = $1
       OR UPPER(COALESCE(ministry_code, '')) = UPPER($1)
       OR UPPER(COALESCE(ministry_name, '')) = UPPER($1)
    LIMIT 1
    `,
    [String(ministryValue).trim()]
  );

  return result.rows[0]?.ministry_id || null;
}

async function resolveAdministrationId(administrationValue) {
  if (!administrationValue || administrationValue === 'Not Assigned') {
    return null;
  }

  const result = await pool.query(
    `
    SELECT id
    FROM blockchain.public_administrations
    WHERE id::TEXT = $1
       OR administration_id::TEXT = $1
       OR UPPER(COALESCE(administration_code, '')) = UPPER($1)
       OR UPPER(COALESCE(administration_name, '')) = UPPER($1)
    LIMIT 1
    `,
    [String(administrationValue).trim()]
  );

  return result.rows[0]?.id || null;
}

router.get('/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::INT AS total_services,
        COUNT(*) FILTER (WHERE service_status = 'ACTIVE')::INT AS active_services,
        COUNT(*) FILTER (WHERE service_status = 'INACTIVE')::INT AS inactive_services,
        COUNT(*) FILTER (WHERE service_status = 'DRAFT')::INT AS draft_services
      FROM blockchain.government_services
    `);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[SERVICES SUMMARY ERROR]', error);

    res.status(500).json({
      success: false,
      message: 'Failed to load services summary',
      error: error.message,
    });
  }
});

router.get('/reference/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        category_id,
        category_code,
        category_name
      FROM blockchain.government_service_categories
      WHERE is_active = TRUE
      ORDER BY category_name ASC
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('[SERVICE CATEGORIES ERROR]', error);

    res.status(500).json({
      success: false,
      message: 'Failed to load service categories',
      error: error.message,
    });
  }
});

router.get('/reference/currency', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        currency_id,
        currency_code,
        currency_name,
        description
      FROM blockchain.gov_currencies
      WHERE currency_code = 'GOV'
        AND is_active = TRUE
      LIMIT 1
    `);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[GOV CURRENCY ERROR]', error);

    res.status(500).json({
      success: false,
      message: 'Failed to load GOV currency',
      error: error.message,
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const {
      search = null,
      ministryId = null,
      categoryId = null,
      status = null,
    } = req.query;

    const result = await pool.query(
      `
      SELECT
          gs.service_id,
          gs.service_public_id,
          gs.service_code,
          gs.service_name,
          gs.arabic_name,
          gs.ministry_id,
          gs.administration_id,
          gs.category_id,
          COALESCE(gm.ministry_name, 'Not Assigned') AS ministry_name,
          COALESCE(pa.administration_name, 'Not Assigned') AS administration_name,
          gsc.category_name,
          gs.fee_amount,
          gs.currency_code,
          gs.required_documents,
          gs.digital_stamp_required,
          gs.processing_time,
          gs.service_status,
          gs.description,
          gs.created_at
      FROM blockchain.government_services gs
      LEFT JOIN blockchain.government_service_categories gsc
          ON gsc.category_id::TEXT = gs.category_id::TEXT
      LEFT JOIN blockchain.government_ministries gm
          ON gm.ministry_id::TEXT = gs.ministry_id::TEXT
      LEFT JOIN blockchain.public_administrations pa
          ON pa.id::TEXT = gs.administration_id::TEXT
      WHERE
          (
              $1::TEXT IS NULL
              OR UPPER(gs.service_public_id) LIKE UPPER('%' || $1 || '%')
              OR UPPER(gs.service_code) LIKE UPPER('%' || $1 || '%')
              OR UPPER(gs.service_name) LIKE UPPER('%' || $1 || '%')
              OR UPPER(COALESCE(gs.arabic_name, '')) LIKE UPPER('%' || $1 || '%')
              OR UPPER(COALESCE(gm.ministry_name, '')) LIKE UPPER('%' || $1 || '%')
          )
      AND (
              $2::TEXT IS NULL
              OR gs.ministry_id::TEXT = $2
              OR gm.ministry_code = $2
          )
      AND (
              $3::TEXT IS NULL
              OR gs.category_id::TEXT = $3
              OR gsc.category_code = $3
              OR gsc.category_name = $3
          )
      AND (
              $4::TEXT IS NULL
              OR gs.service_status = UPPER($4)
          )
      ORDER BY gs.created_at DESC
      `,
      [
        search || null,
        ministryId || null,
        categoryId || null,
        status || null,
      ]
    );

    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('[SERVICES LIST ERROR]', error);

    res.status(500).json({
      success: false,
      message: 'Failed to load government services',
      error: error.message,
    });
  }
});

router.get('/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM blockchain.government_services
      WHERE service_id::TEXT = $1
         OR service_public_id = $1
         OR service_code = $1
      LIMIT 1
      `,
      [serviceId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Government service not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[SERVICE DETAILS ERROR]', error);

    res.status(500).json({
      success: false,
      message: 'Failed to load service details',
      error: error.message,
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      serviceCode,
      serviceName,
      arabicName,
      ministryId,
      administrationId,
      categoryId,
      feeAmount,
      requiredDocuments,
      digitalStampRequired,
      processingTime,
      serviceStatus,
      description,
      createdBy,
    } = req.body;

    if (!serviceCode || !serviceName || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'serviceCode, serviceName, and categoryId are required',
      });
    }

    const resolvedCategoryId = await resolveCategoryId(categoryId);
    const resolvedMinistryId = await resolveMinistryId(ministryId);
    const resolvedAdministrationId = await resolveAdministrationId(administrationId);

    if (!resolvedCategoryId) {
      return res.status(400).json({
        success: false,
        message: `Invalid service category: ${categoryId}`,
      });
    }

    const idResult = await pool.query(`
      SELECT 'SRV-' || LPAD(nextval('blockchain.government_service_seq')::TEXT, 3, '0') AS service_public_id
    `);

    const servicePublicId = idResult.rows[0].service_public_id;

    const insertResult = await pool.query(
      `
      INSERT INTO blockchain.government_services (
          service_public_id,
          service_code,
          service_name,
          arabic_name,
          ministry_id,
          administration_id,
          category_id,
          fee_amount,
          currency_code,
          required_documents,
          digital_stamp_required,
          processing_time,
          service_status,
          description,
          created_by,
          updated_by
      )
      VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          'GOV',
          $9, $10, $11, $12, $13, $14, $14
      )
      RETURNING *
      `,
      [
        servicePublicId,
        serviceCode,
        serviceName,
        arabicName || null,
        resolvedMinistryId,
        resolvedAdministrationId,
        resolvedCategoryId,
        Number(feeAmount || 0),
        requiredDocuments || null,
        normalizeBoolean(digitalStampRequired),
        processingTime || null,
        normalizeStatus(serviceStatus),
        description || null,
        createdBy || 'system',
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Government service created successfully using GOV currency',
      data: insertResult.rows[0],
    });
  } catch (error) {
    console.error('[SERVICE CREATE ERROR]', error);

    res.status(500).json({
      success: false,
      message: 'Failed to create government service',
      error: error.message,
    });
  }
});

router.put('/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;

    const {
      serviceCode,
      serviceName,
      arabicName,
      ministryId,
      administrationId,
      categoryId,
      feeAmount,
      requiredDocuments,
      digitalStampRequired,
      processingTime,
      serviceStatus,
      description,
      updatedBy,
    } = req.body;

    const resolvedCategoryId = categoryId
      ? await resolveCategoryId(categoryId)
      : null;

    const resolvedMinistryId = ministryId
      ? await resolveMinistryId(ministryId)
      : null;

    const resolvedAdministrationId = administrationId
      ? await resolveAdministrationId(administrationId)
      : null;

    const result = await pool.query(
      `
      UPDATE blockchain.government_services
      SET
          service_code = COALESCE($2, service_code),
          service_name = COALESCE($3, service_name),
          arabic_name = COALESCE($4, arabic_name),
          ministry_id = $5,
          administration_id = $6,
          category_id = COALESCE($7, category_id),
          fee_amount = COALESCE($8, fee_amount),
          currency_code = 'GOV',
          required_documents = COALESCE($9, required_documents),
          digital_stamp_required = COALESCE($10, digital_stamp_required),
          processing_time = COALESCE($11, processing_time),
          service_status = COALESCE($12, service_status),
          description = COALESCE($13, description),
          updated_by = COALESCE($14, updated_by),
          updated_at = CURRENT_TIMESTAMP
      WHERE service_id::TEXT = $1
         OR service_public_id = $1
      RETURNING *
      `,
      [
        serviceId,
        serviceCode || null,
        serviceName || null,
        arabicName || null,
        resolvedMinistryId,
        resolvedAdministrationId,
        resolvedCategoryId,
        feeAmount !== undefined ? Number(feeAmount) : null,
        requiredDocuments || null,
        digitalStampRequired !== undefined
          ? normalizeBoolean(digitalStampRequired)
          : null,
        processingTime || null,
        serviceStatus ? normalizeStatus(serviceStatus) : null,
        description || null,
        updatedBy || 'system',
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Government service not found',
      });
    }

    res.json({
      success: true,
      message: 'Government service updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[SERVICE UPDATE ERROR]', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update government service',
      error: error.message,
    });
  }
});

router.patch('/:serviceId/status', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { status, updatedBy } = req.body;

    const result = await pool.query(
      `
      UPDATE blockchain.government_services
      SET
          service_status = $2,
          updated_by = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE service_id::TEXT = $1
         OR service_public_id = $1
      RETURNING *
      `,
      [serviceId, normalizeStatus(status), updatedBy || 'system']
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Government service not found',
      });
    }

    res.json({
      success: true,
      message: 'Service status updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[SERVICE STATUS ERROR]', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update service status',
      error: error.message,
    });
  }
});

router.delete('/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;

    const result = await pool.query(
      `
      DELETE FROM blockchain.government_services
      WHERE service_id::TEXT = $1
         OR service_public_id = $1
      RETURNING *
      `,
      [serviceId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Government service not found',
      });
    }

    res.json({
      success: true,
      message: 'Government service deleted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[SERVICE DELETE ERROR]', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete government service',
      error: error.message,
    });
  }
});

module.exports = router;