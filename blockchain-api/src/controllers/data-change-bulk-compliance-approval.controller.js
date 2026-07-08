const service = require('../services/data-change-bulk-compliance-approval.service');

function success(res, message, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

function failure(res, error, fallbackMessage = 'Bulk compliance approval request failed') {
  const statusCode = Number(error.statusCode || error.status || 500);

  return res.status(statusCode).json({
    success: false,
    message: error.message || fallbackMessage,
    code: error.code || 'BULK_COMPLIANCE_APPROVAL_ERROR',
    timestamp: new Date().toISOString()
  });
}

function requestUser(req) {
  return (
    req.body?.user ||
    req.user?.username ||
    req.user?.email ||
    req.headers['x-user'] ||
    service.SERVICE_NAME
  );
}

async function health(req, res) {
  try {
    const summary = await service.getSummary();

    return success(res, 'Bulk compliance approval API is healthy.', {
      service: service.SERVICE_NAME,
      sourceOfTruth: 'PostgreSQL',
      blockchainStorage: 'proof-only',
      summary
    });
  } catch (error) {
    return failure(res, error, 'Failed to load bulk compliance approval health.');
  }
}

async function summary(req, res) {
  try {
    const data = await service.getSummary();
    return success(res, 'Bulk compliance approval summary loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load bulk compliance approval summary.');
  }
}

async function candidates(req, res) {
  try {
    const data = await service.listCandidates(req.query);
    return success(res, 'Bulk compliance approval candidates loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load bulk compliance approval candidates.');
  }
}

async function batches(req, res) {
  try {
    const data = await service.listBatches(req.query);
    return success(res, 'Bulk compliance approval batches loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load bulk compliance approval batches.');
  }
}

async function batchDetail(req, res) {
  try {
    const batch = await service.getBatch(req.params.batchIdOrKey);
    const items = await service.listBatchItems(req.params.batchIdOrKey, req.query);

    return success(res, 'Bulk compliance approval batch loaded successfully.', {
      batch,
      items
    });
  } catch (error) {
    return failure(res, error, 'Failed to load bulk compliance approval batch.');
  }
}

async function create(req, res) {
  try {
    const data = await service.createBatch({
      ...req.body,
      user: requestUser(req)
    });

    return success(
      res,
      data.dryRun
        ? 'Bulk compliance approval dry run completed successfully.'
        : 'Bulk compliance approval batch created successfully.',
      data,
      data.created ? 201 : 200
    );
  } catch (error) {
    return failure(res, error, 'Failed to create bulk compliance approval batch.');
  }
}

async function approve(req, res) {
  try {
    const data = await service.approveBatch(req.params.batchIdOrKey, {
      ...req.body,
      user: requestUser(req)
    });

    return success(
      res,
      data.dryRun
        ? 'Bulk compliance approval dry-run approval completed successfully.'
        : 'Bulk compliance approval batch processed successfully.',
      data
    );
  } catch (error) {
    return failure(res, error, 'Failed to approve bulk compliance approval batch.');
  }
}

async function reject(req, res) {
  try {
    const data = await service.rejectBatch(req.params.batchIdOrKey, {
      ...req.body,
      user: requestUser(req)
    });

    return success(
      res,
      data.dryRun
        ? 'Bulk compliance approval dry-run rejection completed successfully.'
        : 'Bulk compliance approval batch rejected successfully.',
      data
    );
  } catch (error) {
    return failure(res, error, 'Failed to reject bulk compliance approval batch.');
  }
}

module.exports = {
  health,
  summary,
  candidates,
  batches,
  batchDetail,
  create,
  approve,
  reject
};
