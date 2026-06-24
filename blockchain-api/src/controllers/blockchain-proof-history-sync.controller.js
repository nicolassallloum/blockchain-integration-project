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
  createValidationRun
};
