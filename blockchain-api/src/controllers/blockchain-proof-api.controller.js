const historySyncService = require('../services/blockchain-proof-history-sync.service');

function getQuery(req) {
  return req.query || {};
}

async function health(req, res) {
  try {
    const data = await historySyncService.healthCheck();

    return res.status(data.ready ? 200 : 500).json({
      success: data.ready,
      message: data.ready
        ? 'Blockchain proof API is ready'
        : 'Blockchain proof API is not ready',
      data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to check blockchain proof API health',
      error: error.message
    });
  }
}

async function createCandidates(req, res) {
  try {
    const { recordType } = req.params;
    const { limit, offset } = getQuery(req);

    const data = await historySyncService.detectCreateRecords(recordType, limit, offset);

    return res.status(200).json({
      success: true,
      message: 'CREATE candidates loaded successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to load CREATE candidates',
      error: error.message
    });
  }
}

async function updateCandidates(req, res) {
  try {
    const { recordType } = req.params;
    const { limit, offset } = getQuery(req);

    const data = await historySyncService.detectUpdateRecords(recordType, limit, offset);

    return res.status(200).json({
      success: true,
      message: 'UPDATE candidates loaded successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to load UPDATE candidates',
      error: error.message
    });
  }
}

async function unchangedRecords(req, res) {
  try {
    const { recordType } = req.params;
    const { limit, offset } = getQuery(req);

    const data = await historySyncService.detectUnchangedRecords(recordType, limit, offset);

    return res.status(200).json({
      success: true,
      message: 'Unchanged records loaded successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to load unchanged records',
      error: error.message
    });
  }
}

async function hashPreview(req, res) {
  try {
    const { recordType } = req.params;
    const { limit, offset } = getQuery(req);

    const data = await historySyncService.previewStableHashes(recordType, limit, offset);

    return res.status(200).json({
      success: true,
      message: 'Stable hash preview loaded successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to load stable hash preview',
      error: error.message
    });
  }
}

async function hashOne(req, res) {
  try {
    const { recordType } = req.params;

    const data = await historySyncService.generateStableHashForSourceRecord(
      recordType,
      getQuery(req)
    );

    return res.status(200).json({
      success: true,
      message: 'Stable hash generated successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to generate stable hash',
      error: error.message
    });
  }
}

async function blockchainKeyPreview(req, res) {
  try {
    const { recordType } = req.params;
    const { limit, offset } = getQuery(req);

    const data = await historySyncService.previewBlockchainKeys(recordType, limit, offset);

    return res.status(200).json({
      success: true,
      message: 'Blockchain key preview loaded successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to load blockchain key preview',
      error: error.message
    });
  }
}

async function blockchainKeyOne(req, res) {
  try {
    const { recordType } = req.params;

    const data = await historySyncService.generateBlockchainKeyForSourceRecord(
      recordType,
      getQuery(req)
    );

    return res.status(200).json({
      success: true,
      message: 'Blockchain key generated successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to generate blockchain key',
      error: error.message
    });
  }
}

async function proofOnlyPreview(req, res) {
  try {
    const { recordType } = req.params;

    const data = await historySyncService.buildProofOnlyPayloadForSourceRecord(
      recordType,
      getQuery(req),
      {
        actionType: req.query.actionType || 'CREATE',
        postgresHistoryId: req.query.postgresHistoryId || 'PENDING_STEP_14'
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Proof-only payload preview generated successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to generate proof-only payload preview',
      error: error.message
    });
  }
}

async function proofOnlySubmit(req, res) {
  try {
    const { recordType } = req.params;

    const data = await historySyncService.submitProofOnlyForSourceRecord(
      recordType,
      getQuery(req),
      {
        actionType: req.query.actionType || 'CREATE',
        postgresHistoryId: req.query.postgresHistoryId || 'PENDING_STEP_14',
        dryRun: String(req.query.dryRun || 'true').toLowerCase() === 'false'
          ? false
          : true
      }
    );

    return res.status(200).json({
      success: true,
      message: data.submission.dryRun
        ? 'Proof-only dry run completed successfully'
        : 'Proof-only payload submitted successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to submit proof-only payload',
      error: error.message
    });
  }
}

async function transactionLink(req, res) {
  try {
    const { historyId } = req.params;

    const data = await historySyncService.getBlockchainTransactionLink(historyId);

    return res.status(200).json({
      success: true,
      message: 'Transaction link loaded successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to load transaction link',
      error: error.message
    });
  }
}

async function linkTransaction(req, res) {
  try {
    const { historyId } = req.params;
    const blockchainTransactionId =
      req.body?.blockchainTransactionId ||
      req.query.blockchainTransactionId ||
      req.query.txId;

    const data = await historySyncService.linkBlockchainTransactionToPostgresHistory(
      historyId,
      blockchainTransactionId,
      {
        linkedBy: req.body?.linkedBy || req.query.linkedBy || 'blockchain-proof-api'
      }
    );

    return res.status(200).json({
      success: true,
      message: data.message,
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to link transaction ID',
      error: error.message
    });
  }
}

module.exports = {
  health,
  createCandidates,
  updateCandidates,
  unchangedRecords,
  hashPreview,
  hashOne,
  blockchainKeyPreview,
  blockchainKeyOne,
  proofOnlyPreview,
  proofOnlySubmit,
  transactionLink,
  linkTransaction
};
