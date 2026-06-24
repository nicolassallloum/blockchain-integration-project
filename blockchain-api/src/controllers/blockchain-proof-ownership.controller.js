const {
  getOwnershipModel,
  getOwnershipArea,
  validateOwnershipModel
} = require('../services/blockchain-proof-ownership.service');

function getOwnership(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Blockchain proof ownership model loaded successfully',
    data: getOwnershipModel()
  });
}

function getOwnershipByArea(req, res) {
  const { area } = req.params;

  const ownershipArea = getOwnershipArea(area);

  if (!ownershipArea) {
    return res.status(404).json({
      success: false,
      message: 'Ownership area not found',
      data: {
        requestedArea: area
      }
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Ownership area loaded successfully',
    data: ownershipArea
  });
}

function validateOwnership(req, res) {
  const validation = validateOwnershipModel();

  return res.status(validation.valid ? 200 : 400).json({
    success: validation.valid,
    message: validation.message,
    data: validation
  });
}

module.exports = {
  getOwnership,
  getOwnershipByArea,
  validateOwnership
};
