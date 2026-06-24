const ownershipConfig = require('../config/blockchain-proof-ownership.config');

function getOwnershipModel() {
  return ownershipConfig;
}

function getOwnershipArea(areaName) {
  const area = ownershipConfig.ownershipModel[areaName];

  if (!area) {
    return null;
  }

  return {
    area: areaName,
    ...area
  };
}

function validateOwnershipModel() {
  const requiredAreas = [
    'postgresqlSourceViews',
    'postgresqlHistoryTables',
    'backendSyncService',
    'hashGeneration',
    'blockchainChaincode',
    'blockchainProofRecord',
    'retryLogic',
    'verificationLogic',
    'dashboardAndMonitoring',
    'securityValidation'
  ];

  const missingAreas = requiredAreas.filter(
    (area) => !ownershipConfig.ownershipModel[area]
  );

  return {
    valid: missingAreas.length === 0,
    requiredAreas,
    missingAreas,
    message:
      missingAreas.length === 0
        ? 'Ownership model is complete'
        : 'Ownership model is incomplete'
  };
}

module.exports = {
  getOwnershipModel,
  getOwnershipArea,
  validateOwnershipModel
};
