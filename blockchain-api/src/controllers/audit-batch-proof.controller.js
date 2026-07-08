const service = require('../services/audit-batch-proof.service');

function success(res, message, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

function failure(res, error, fallbackMessage = 'Audit batch proof request failed') {
  const statusCode = Number(error.statusCode || error.status || 500);

  return res.status(statusCode).json({
    success: false,
    message: error.message || fallbackMessage,
    code: error.code || 'AUDIT_BATCH_PROOF_ERROR'
  });
}

function requestUser(req) {
  return (
    req.body?.createdBy ||
    req.body?.submittedBy ||
    req.user?.username ||
    req.user?.email ||
    req.headers['x-user'] ||
    service.SERVICE_NAME
  );
}

async function health(req, res) {
  try {
    const summary = await service.getSummary();

    return success(res, 'Audit batch proof API is healthy.', {
      service: service.SERVICE_NAME,
      summary
    });
  } catch (error) {
    return failure(res, error, 'Failed to load audit batch proof health.');
  }
}

async function summary(req, res) {
  try {
    const data = await service.getSummary();
    return success(res, 'Audit batch proof summary loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load audit batch proof summary.');
  }
}

async function listBatches(req, res) {
  try {
    const rows = await service.listBatches(req.query);

    return success(res, 'Audit batch proofs loaded successfully.', {
      count: rows.length,
      rows
    });
  } catch (error) {
    return failure(res, error, 'Failed to load audit batch proofs.');
  }
}

async function createBatch(req, res) {
  try {
    const data = await service.createBatch({
      ...req.query,
      ...req.body,
      createdBy: requestUser(req)
    });

    return success(
      res,
      data.dryRun
        ? 'Audit batch proof dry run completed successfully.'
        : 'Audit batch proof created successfully.',
      data,
      data.created ? 201 : 200
    );
  } catch (error) {
    return failure(res, error, 'Failed to create audit batch proof.');
  }
}

async function getBatch(req, res) {
  try {
    const data = await service.getBatchItems(req.params.batchIdOrKey);
    return success(res, 'Audit batch proof details loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load audit batch proof details.');
  }
}

async function submitBatch(req, res) {
  try {
    const data = await service.submitBatch(req.params.batchIdOrKey, {
      ...req.body,
      dryRun: req.body?.dryRun === true || req.query?.dryRun === 'true',
      submittedBy: requestUser(req),
      requestId: req.requestId || req.correlationId || req.headers['x-request-id']
    });

    return success(res, 'Audit batch proof submit request completed.', data);
  } catch (error) {
    return failure(res, error, 'Failed to submit audit batch proof.');
  }
}

async function getFabricBatchProof(req, res) {
  try {
    const data = await service.getFabricBatchProof(req.params.batchIdOrKey);
    return success(res, 'Audit batch proof loaded from Fabric successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load audit batch proof from Fabric.');
  }
}

async function verifyBatchProof(req, res) {
  try {
    const data = await service.verifyBatchProof(req.params.batchIdOrKey, {
      ...req.query,
      ...req.body
    });

    return success(res, 'Audit batch proof verification completed.', data);
  } catch (error) {
    return failure(res, error, 'Failed to verify audit batch proof.');
  }
}

async function verifyBatchItem(req, res) {
  try {
    const data = await service.verifyAuditEventInsideBatch(
      req.params.batchIdOrKey,
      req.params.auditId
    );

    return success(res, 'Audit event verified inside batch successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to verify audit event inside batch.');
  }
}

module.exports = {
  health,
  summary,
  listBatches,
  createBatch,
  getBatch,
  submitBatch,
  getFabricBatchProof,
  verifyBatchProof,
  verifyBatchItem
};
