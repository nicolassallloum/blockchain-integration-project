const {
  getSourceViews,
  getSourceViewByRecordType,
  validateSourceViewsConfig
} = require('../services/blockchain-proof-source-views.service');

function listSourceViews(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Blockchain proof source views loaded successfully',
    data: getSourceViews()
  });
}

function getSourceView(req, res) {
  const { recordType } = req.params;

  const sourceView = getSourceViewByRecordType(recordType);

  if (!sourceView) {
    return res.status(404).json({
      success: false,
      message: 'Source view record type not found',
      data: {
        requestedRecordType: recordType
      }
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Source view loaded successfully',
    data: sourceView
  });
}

function validateSourceViews(req, res) {
  const validation = validateSourceViewsConfig();

  return res.status(validation.valid ? 200 : 400).json({
    success: validation.valid,
    message: validation.message,
    data: validation
  });
}

module.exports = {
  listSourceViews,
  getSourceView,
  validateSourceViews
};
