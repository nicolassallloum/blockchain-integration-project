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
  const requiredAreas = ownershipConfig.requiredAreas || [];

  const missingAreas = requiredAreas.filter(
    (area) => !ownershipConfig.ownershipModel[area]
  );

  const invalidRules = [];

  if (!ownershipConfig.ownershipModel.postgresqlBusinessData?.systemOfRecord) {
    invalidRules.push('PostgreSQL must remain the system of record.');
  }

  if (ownershipConfig.ownershipModel.hyperledgerFabricProof?.storesSensitiveData) {
    invalidRules.push('Hyperledger Fabric must not store sensitive business data.');
  }

  if (
    !ownershipConfig.ownershipModel.complianceAuditApproval
      ?.approvalRequiredBeforeSubmission
  ) {
    invalidRules.push(
      'Compliance/Audit approval must be required before blockchain submission.'
    );
  }

  if (!ownershipConfig.ownershipModel.backendIntegrationLogic?.ownsHashGeneration) {
    invalidRules.push('Backend API must own stable hash generation.');
  }

  if (!ownershipConfig.ownershipModel.backendIntegrationLogic?.ownsFabricSubmission) {
    invalidRules.push('Backend API must own Fabric submission.');
  }

  if (!ownershipConfig.ownershipModel.backendIntegrationLogic?.ownsRetryLogic) {
    invalidRules.push('Backend API must own retry logic.');
  }

  if (!ownershipConfig.ownershipModel.backendIntegrationLogic?.ownsVerificationLogic) {
    invalidRules.push('Backend API must own verification logic.');
  }

  const valid = missingAreas.length === 0 && invalidRules.length === 0;

  return {
    valid,
    requiredAreas,
    missingAreas,
    invalidRules,
    message: valid
      ? 'Phase 2 ownership model is complete and valid'
      : 'Phase 2 ownership model is incomplete or invalid'
  };
}

module.exports = {
  getOwnershipModel,
  getOwnershipArea,
  validateOwnershipModel
};
