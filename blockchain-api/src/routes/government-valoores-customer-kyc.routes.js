'use strict';

const express = require('express');
const customerKycProofService = require('../services/customer-kyc-blockchain-proof.service');

const router = express.Router();

function successResponse(res, data, message = 'Request completed successfully.') {
  return res.status(200).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

function errorResponse(res, error, message = 'Valoores Customer KYC request failed.') {
  console.error('[VALOORES_CUSTOMER_KYC_ERROR]', {
    message: error.message,
    code: error.code || null,
    statusCode: error.statusCode || null
  });

  return res.status(error.statusCode || 500).json({
    success: false,
    message,
    error: error.message,
    code: error.code || 'VALOORES_CUSTOMER_KYC_ERROR',
    timestamp: new Date().toISOString()
  });
}

/**
 * GET /api/v1/government-blockchain/valoores-customer-kyc/proof/preview/:sourceRecordId
 *
 * Builds the Phase 14 Customer KYC proof payload from blockchain.valoores_customer_kyc only.
 * This endpoint does not submit to Fabric.
 * Only approved/activated records are accepted: record_status = 79.
 */
router.get('/proof/preview/:sourceRecordId', async (req, res) => {
  try {
    const result = await customerKycProofService.previewCustomerKycProof(
      req.params.sourceRecordId,
      {
        submittedBy: req.query.submittedBy || 'phase-14-api-preview'
      }
    );

    return successResponse(
      res,
      result,
      'Customer KYC blockchain proof preview generated successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to preview Customer KYC blockchain proof.');
  }
});

/**
 * POST /api/v1/government-blockchain/valoores-customer-kyc/proof/submit
 * POST /api/v1/government-blockchain/valoores-customer-kyc/proof/submit/:sourceRecordId
 *
 * Submits one approved Customer KYC proof using blockchain.valoores_customer_kyc as the only proof input source.
 */
async function submitCustomerKycProofRequest(req, res) {
  try {
    const sourceRecordId = (
      req.params.sourceRecordId ||
      req.body.sourceRecordId ||
      req.body.source_record_id ||
      req.query.sourceRecordId ||
      req.query.source_record_id
    );

    const result = await customerKycProofService.submitCustomerKycProof(
      sourceRecordId,
      {
        submittedBy: req.body.submittedBy ||
          req.body.submitted_by ||
          req.query.submittedBy ||
          'phase-14-api-submit'
      }
    );

    return successResponse(
      res,
      result,
      'Customer KYC blockchain proof submitted successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to submit Customer KYC blockchain proof.');
  }
}

router.post('/proof/submit', submitCustomerKycProofRequest);
router.post('/proof/submit/:sourceRecordId', submitCustomerKycProofRequest);

/**
 * GET /api/v1/government-blockchain/valoores-customer-kyc/proof/verify/preview/:sourceRecordId
 *
 * Builds the Phase 14 Customer KYC verification payload from blockchain.valoores_customer_kyc only.
 * This endpoint does not call Fabric.
 */
router.get('/proof/verify/preview/:sourceRecordId', async (req, res) => {
  try {
    const result = await customerKycProofService.previewCustomerKycVerification(
      req.params.sourceRecordId,
      {
        verifiedBy: req.query.verifiedBy || 'phase-14-api-verify-preview'
      }
    );

    return successResponse(
      res,
      result,
      'Customer KYC blockchain proof verification preview generated successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to preview Customer KYC blockchain proof verification.');
  }
});

/**
 * POST /api/v1/government-blockchain/valoores-customer-kyc/proof/verify
 * POST /api/v1/government-blockchain/valoores-customer-kyc/proof/verify/:sourceRecordId
 *
 * Verifies one approved Customer KYC proof using blockchain.valoores_customer_kyc as the only proof input source.
 */
async function verifyCustomerKycProofRequest(req, res) {
  try {
    const sourceRecordId = (
      req.params.sourceRecordId ||
      req.body.sourceRecordId ||
      req.body.source_record_id ||
      req.query.sourceRecordId ||
      req.query.source_record_id
    );

    const result = await customerKycProofService.verifyCustomerKycProof(
      sourceRecordId,
      {
        verifiedBy: req.body.verifiedBy ||
          req.body.verified_by ||
          req.query.verifiedBy ||
          'phase-14-api-verify'
      }
    );

    return successResponse(
      res,
      result,
      'Customer KYC blockchain proof verified successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to verify Customer KYC blockchain proof.');
  }
}

router.post('/proof/verify', verifyCustomerKycProofRequest);
router.post('/proof/verify/:sourceRecordId', verifyCustomerKycProofRequest);

/**
 * GET /api/v1/government-blockchain/valoores-customer-kyc/proof/status
 * GET /api/v1/government-blockchain/valoores-customer-kyc/proof/status/:sourceRecordId
 *
 * Shows Customer KYC blockchain submission and verification status.
 */
router.get('/proof/status', async (req, res) => {
  try {
    const result = await customerKycProofService.getCustomerKycBlockchainStatus({
      limit: req.query.limit,
      offset: req.query.offset,
      search: req.query.search
    });

    return successResponse(
      res,
      result,
      'Customer KYC blockchain status loaded successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to load Customer KYC blockchain status.');
  }
});

router.get('/proof/status/:sourceRecordId', async (req, res) => {
  try {
    const result = await customerKycProofService.getCustomerKycBlockchainStatus({
      sourceRecordId: req.params.sourceRecordId,
      limit: 1,
      offset: 0
    });

    return successResponse(
      res,
      result,
      'Customer KYC blockchain status loaded successfully.'
    );
  } catch (error) {
    return errorResponse(res, error, 'Failed to load Customer KYC blockchain status.');
  }
});

module.exports = router;
