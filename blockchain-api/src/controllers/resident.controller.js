const residentService = require('../services/resident.service');

function sendSuccess(res, message, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

function sendError(res, error) {
  console.error('[RESIDENT_CONTROLLER_ERROR]', error);

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
}

async function createResident(req, res) {
  try {
    const resident = await residentService.createResident(req.body);

    return sendSuccess(
      res,
      'Resident account created successfully.',
      resident,
      201
    );
  } catch (error) {
    return sendError(res, error);
  }
}

async function saveDraft(req, res) {
  try {
    const draft = await residentService.saveDraft(req.body);

    return sendSuccess(
      res,
      'Resident draft saved successfully.',
      draft,
      201
    );
  } catch (error) {
    return sendError(res, error);
  }
}

async function createWallet(req, res) {
  try {
    const { residentId } = req.params;

    const result = await residentService.createWallet(residentId, req.body || {});

    return sendSuccess(
      res,
      'Resident wallet created successfully.',
      result,
      201
    );
  } catch (error) {
    return sendError(res, error);
  }
}

async function submitKyc(req, res) {
  try {
    const { residentId } = req.params;

    const result = await residentService.submitKyc(residentId, req.body || {});

    return sendSuccess(
      res,
      'Resident KYC submitted successfully.',
      result,
      200
    );
  } catch (error) {
    return sendError(res, error);
  }
}

async function getResidentById(req, res) {
  try {
    const { residentId } = req.params;

    const resident = await residentService.getResidentById(residentId);

    return sendSuccess(
      res,
      'Resident retrieved successfully.',
      resident,
      200
    );
  } catch (error) {
    return sendError(res, error);
  }
}

async function searchResidents(req, res) {
  try {
    const residents = await residentService.searchResidents(req.query || {});

    return sendSuccess(
      res,
      'Residents retrieved successfully.',
      residents,
      200
    );
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  createResident,
  saveDraft,
  createWallet,
  submitKyc,
  getResidentById,
  searchResidents,
};
