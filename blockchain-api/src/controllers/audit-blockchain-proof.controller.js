const service = require('../services/audit-blockchain-proof.service');

function success(res, message, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

function failure(res, error, fallbackMessage = 'Audit blockchain proof request failed') {
  const statusCode = Number(error.statusCode || error.status || 500);

  return res.status(statusCode).json({
    success: false,
    message: error.message || fallbackMessage,
    code: error.code || 'AUDIT_BLOCKCHAIN_PROOF_ERROR'
  });
}

async function health(req, res) {
  try {
    const summary = await service.getSummary();

    return success(res, 'Audit blockchain proof API is healthy.', {
      service: service.SERVICE_NAME,
      summary
    });
  } catch (error) {
    return failure(res, error, 'Failed to load audit blockchain proof health.');
  }
}

async function summary(req, res) {
  try {
    const data = await service.getSummary();
    return success(res, 'Audit blockchain proof summary loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load audit blockchain proof summary.');
  }
}

async function pending(req, res) {
  try {
    const data = await service.listOutbox({
      status: req.query.status || 'PENDING',
      limit: req.query.limit
    });

    return success(res, 'Audit blockchain proof outbox rows loaded successfully.', {
      count: data.length,
      rows: data
    });
  } catch (error) {
    return failure(res, error, 'Failed to load audit blockchain proof outbox rows.');
  }
}

async function submitByOutboxId(req, res) {
  try {
    const data = await service.submitOutboxById(req.params.outboxId, {
      dryRun: req.body?.dryRun === true || req.query?.dryRun === 'true',
      workerName: req.body?.workerName || req.user?.username || req.user?.email || service.SERVICE_NAME,
      requestId: req.requestId || req.correlationId || req.headers['x-request-id']
    });

    return success(res, 'Audit blockchain proof submit request completed.', data);
  } catch (error) {
    return failure(res, error, 'Failed to submit audit blockchain proof.');
  }
}

async function submitNext(req, res) {
  try {
    const data = await service.submitNext({
      dryRun: req.body?.dryRun === true || req.query?.dryRun === 'true',
      workerName: req.body?.workerName || req.user?.username || req.user?.email || service.SERVICE_NAME,
      requestId: req.requestId || req.correlationId || req.headers['x-request-id']
    });

    return success(res, 'Next audit blockchain proof submit request completed.', data);
  } catch (error) {
    return failure(res, error, 'Failed to submit next audit blockchain proof.');
  }
}

async function getFabricProof(req, res) {
  try {
    const data = await service.getAuditEventProof(req.params.auditIdOrBlockchainKey);
    return success(res, 'Audit event proof loaded from Fabric successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load audit event proof from Fabric.');
  }
}

async function verifyFabricProof(req, res) {
  try {
    const data = await service.verifyAuditEventProof({
      ...req.body,
      ...req.query
    });

    return success(res, 'Audit event proof verification completed.', data);
  } catch (error) {
    return failure(res, error, 'Failed to verify audit event proof.');
  }
}

module.exports = {
  health,
  summary,
  pending,
  submitByOutboxId,
  submitNext,
  getFabricProof,
  verifyFabricProof
};
