'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

const {
  createPublicAdministration,
  createPublicAdministrationWallet,
  bulkUploadPublicAdministrations,
  savePublicAdministrationDraft,
  getNextPublicAdministrationCodes
} = require('../controllers/publicAdministration.controller');

router.post('/', createPublicAdministration);

/**
 * GET /api/v1/government-blockchain/public-administrations/dropdown
 * Load public administrations from PostgreSQL for Government Services dropdown.
 *
 * Returns:
 * - id: administration_id value used by blockchain.government_services.administration_id
 * - name: administration_name shown in UI
 */
router.get('/dropdown', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id AS id,
        administration_name AS name
      FROM blockchain.public_administrations
      WHERE id IS NOT NULL
        AND administration_name IS NOT NULL
      ORDER BY administration_name ASC
    `);

    return res.json({
      success: true,
      message: 'Public administrations dropdown loaded successfully from PostgreSQL',
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('[PUBLIC_ADMINISTRATIONS_DROPDOWN_ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load public administrations dropdown',
      error: error.message,
    });
  }
});


router.get('/next-codes', getNextPublicAdministrationCodes);
router.post('/bulk-upload', bulkUploadPublicAdministrations);
router.post('/drafts', savePublicAdministrationDraft);
router.post('/:administrationId/wallet', createPublicAdministrationWallet);
// router.post('/:administrationId/wallet', getNextPublicAdministrationCodes);

module.exports = router;
