const historySyncService = require('../services/blockchain-proof-history-sync.service');

async function healthCheck(req, res) {
  try {
    const data = await historySyncService.healthCheck();

    return res.status(data.ready ? 200 : 500).json({
      success: data.ready,
      message: data.ready
        ? 'Generic history sync service is ready'
        : 'Generic history sync service is not ready',
      data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to check generic history sync service health',
      error: error.message
    });
  }
}

async function previewSourceRecords(req, res) {
  try {
    const { recordType } = req.params;
    const { limit, offset } = req.query;

    const data = await historySyncService.previewSourceRecords(recordType, limit, offset);
    const totalRecords = await historySyncService.countSourceRecords(recordType);

    return res.status(200).json({
      success: true,
      message: 'Source records preview loaded successfully',
      data: {
        totalRecords,
        ...data
      }
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to preview source records',
      error: error.message
    });
  }
}


async function detectCreateRecords(req, res) {
  try {
    const { recordType } = req.params;
    const { limit, offset } = req.query;

    const data = await historySyncService.detectCreateRecords(recordType, limit, offset);

    return res.status(200).json({
      success: true,
      message: 'CREATE candidates detected successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to detect CREATE candidates',
      error: error.message
    });
  }
}


async function detectUpdateRecords(req, res) {
  try {
    const { recordType } = req.params;
    const { limit, offset } = req.query;

    const data = await historySyncService.detectUpdateRecords(recordType, limit, offset);

    return res.status(200).json({
      success: true,
      message: 'UPDATE candidates detected successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to detect UPDATE candidates',
      error: error.message
    });
  }
}


async function detectUnchangedRecords(req, res) {
  try {
    const { recordType } = req.params;
    const { limit, offset } = req.query;

    const data = await historySyncService.detectUnchangedRecords(recordType, limit, offset);

    return res.status(200).json({
      success: true,
      message: 'Unchanged records detected successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to detect unchanged records',
      error: error.message
    });
  }
}


async function generateStableHash(req, res) {
  try {
    const { recordType } = req.params;

    const data = await historySyncService.generateStableHashForSourceRecord(
      recordType,
      req.query
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

async function validateStableHash(req, res) {
  try {
    const { recordType } = req.params;

    const data = await historySyncService.validateStableHashForSourceRecord(
      recordType,
      req.query
    );

    return res.status(data.deterministic ? 200 : 500).json({
      success: data.deterministic,
      message: data.message,
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to validate stable hash',
      error: error.message
    });
  }
}

async function previewStableHashes(req, res) {
  try {
    const { recordType } = req.params;
    const { limit, offset } = req.query;

    const data = await historySyncService.previewStableHashes(recordType, limit, offset);

    return res.status(200).json({
      success: true,
      message: 'Stable hash preview loaded successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to preview stable hashes',
      error: error.message
    });
  }
}


async function generateBlockchainKey(req, res) {
  try {
    const { recordType } = req.params;

    const data = await historySyncService.generateBlockchainKeyForSourceRecord(
      recordType,
      req.query
    );

    return res.status(200).json({
      success: true,
      message: 'Blockchain proof key generated successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to generate blockchain proof key',
      error: error.message
    });
  }
}

async function previewBlockchainKeys(req, res) {
  try {
    const { recordType } = req.params;
    const { limit, offset } = req.query;

    const data = await historySyncService.previewBlockchainKeys(recordType, limit, offset);

    return res.status(200).json({
      success: true,
      message: 'Blockchain proof key preview loaded successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to preview blockchain proof keys',
      error: error.message
    });
  }
}

async function validateBlockchainKey(req, res) {
  try {
    const { blockchainKey } = req.query;

    const data = historySyncService.validateBlockchainProofKey(blockchainKey);

    return res.status(data.valid ? 200 : 400).json({
      success: data.valid,
      message: data.message,
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to validate blockchain proof key',
      error: error.message
    });
  }
}


async function getFabricSubmitDiagnostics(req, res) {
  try {
    const data = historySyncService.getFabricSubmitDiagnostics();

    return res.status(200).json({
      success: true,
      message: 'Fabric submit diagnostics loaded successfully',
      data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load Fabric submit diagnostics',
      error: error.message
    });
  }
}

async function previewProofOnlyPayload(req, res) {
  try {
    const { recordType } = req.params;

    const data = await historySyncService.buildProofOnlyPayloadForSourceRecord(
      recordType,
      req.query,
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
      message: 'Failed to preview proof-only payload',
      error: error.message
    });
  }
}

async function submitProofOnly(req, res) {
  try {
    const { recordType } = req.params;

    const data = await historySyncService.submitProofOnlyForSourceRecord(
      recordType,
      req.query,
      {
        actionType: req.query.actionType || 'CREATE',
        postgresHistoryId: req.query.postgresHistoryId || 'PENDING_STEP_14',
        dryRun: req.query.dryRun || 'true'
      }
    );

    return res.status(200).json({
      success: true,
      message: data.submission.dryRun
        ? 'Proof-only submission dry run completed successfully'
        : 'Proof-only payload submitted to blockchain successfully',
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

async function createValidationRun(req, res) {
  try {
    const { recordType } = req.params;

    const data = await historySyncService.createValidationRun(recordType);

    return res.status(201).json({
      success: true,
      message: 'Validation sync run created successfully',
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to create validation sync run',
      error: error.message
    });
  }
}

module.exports = {
  healthCheck,
  previewSourceRecords,
  detectCreateRecords,
  detectUpdateRecords,
  detectUnchangedRecords,
  generateStableHash,
  validateStableHash,
  previewStableHashes,
  generateBlockchainKey,
  previewBlockchainKeys,
  validateBlockchainKey,
  getFabricSubmitDiagnostics,
  previewProofOnlyPayload,
  submitProofOnly,
  createValidationRun
};

