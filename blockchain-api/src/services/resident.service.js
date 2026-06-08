const residentRepository = require('../repositories/resident.repository');

function validateCreateResident(payload) {
  const requiredFields = [
    'residentId',
    'firstName',
    'lastName',
    'fullName',
    'nationalIdNumber',
    'mobileNumber',
    'email',
  ];

  const missingFields = requiredFields.filter((field) => {
    return payload[field] === undefined || payload[field] === null || payload[field] === '';
  });

  if (missingFields.length > 0) {
    const error = new Error(`Missing required fields: ${missingFields.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }
}

function generateWalletAddress(residentId) {
  const cleanResidentId = String(residentId || 'RES')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

  const randomPartOne = Math.random().toString(16).substring(2, 10).toUpperCase();
  const randomPartTwo = Math.random().toString(16).substring(2, 10).toUpperCase();

  return `0xRES${cleanResidentId}${randomPartOne}${randomPartTwo}`;
}

async function createResident(payload) {
  validateCreateResident(payload);

  const existingResident = await residentRepository.findResidentById(payload.residentId);

  if (existingResident) {
    const error = new Error(`Resident already exists with ID: ${payload.residentId}`);
    error.statusCode = 409;
    throw error;
  }

  const resident = await residentRepository.createResident(payload);

  await residentRepository.insertAuditLog({
    moduleName: 'GOVERNMENT_BLOCKCHAIN',
    actionName: 'CREATE_RESIDENT',
    entityType: 'RESIDENT',
    entityId: resident.resident_id,
    requestPayload: payload,
    responsePayload: resident,
    status: 'SUCCESS',
  });

  return resident;
}

async function saveDraft(payload) {
  if (!payload.residentId) {
    const error = new Error('residentId is required to save draft.');
    error.statusCode = 400;
    throw error;
  }

  const draft = await residentRepository.createOrUpdateDraft(payload);

  await residentRepository.insertAuditLog({
    moduleName: 'GOVERNMENT_BLOCKCHAIN',
    actionName: 'SAVE_RESIDENT_DRAFT',
    entityType: 'RESIDENT',
    entityId: draft.resident_id,
    requestPayload: payload,
    responsePayload: draft,
    status: 'SUCCESS',
  });

  return draft;
}

async function createWallet(residentId, payload) {
  const resident = await residentRepository.findResidentById(residentId);
  const crypto = require('crypto');
  function generateTemporaryWalletPassword() {
    return `WALLET-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }
  if (!resident) {
    const error = new Error(`Resident not found with ID: ${residentId}`);
    error.statusCode = 404;
    throw error;
  }

  if (resident.wallet_address) {
    const error = new Error(`Wallet already exists for resident: ${residentId}`);
    error.statusCode = 409;
    throw error;
  }

  const walletAddress = generateWalletAddress(residentId);

  const walletResult = await residentRepository.createWallet(residentId, {
    walletAddress,
    walletCurrency: 'GOV',
    walletStatus: 'Active',
    blockchainStatus: 'PENDING',
    fabricTxId: null,
  });

  await residentRepository.insertAuditLog({
    moduleName: 'GOVERNMENT_BLOCKCHAIN',
    actionName: 'CREATE_RESIDENT_WALLET',
    entityType: 'RESIDENT_WALLET',
    entityId: residentId,
    requestPayload: payload,
    responsePayload: walletResult,
    status: 'SUCCESS',
  });

  return walletResult;
}

async function submitKyc(residentId, payload) {
  const resident = await residentRepository.findResidentById(residentId);

  if (!resident) {
    const error = new Error(`Resident not found with ID: ${residentId}`);
    error.statusCode = 404;
    throw error;
  }

  const kycPayload = {
    kycStatus: payload.kycStatus || 'Pending Review',
    riskCategory: payload.riskCategory || resident.risk_category || 'Low',
  };

  const result = await residentRepository.submitKyc(residentId, kycPayload);

  await residentRepository.insertAuditLog({
    moduleName: 'GOVERNMENT_BLOCKCHAIN',
    actionName: 'SUBMIT_RESIDENT_KYC',
    entityType: 'RESIDENT_KYC',
    entityId: residentId,
    requestPayload: payload,
    responsePayload: result,
    status: 'SUCCESS',
  });

  return result;
}

async function getResidentById(residentId) {
  const resident = await residentRepository.findResidentById(residentId);

  if (!resident) {
    const error = new Error(`Resident not found with ID: ${residentId}`);
    error.statusCode = 404;
    throw error;
  }

  return resident;
}

async function searchResidents(filters) {
  return residentRepository.searchResidents(filters);
}

module.exports = {
  createResident,
  saveDraft,
  createWallet,
  submitKyc,
  getResidentById,
  searchResidents,
};
