const service = require('../services/data-change-compliance-proof-rule.service');

function success(res, message, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

function failure(res, error, fallbackMessage = 'Compliance proof rule request failed') {
  const statusCode = Number(error.statusCode || error.status || 500);

  return res.status(statusCode).json({
    success: false,
    message: error.message || fallbackMessage,
    code: error.code || 'COMPLIANCE_PROOF_RULE_ERROR',
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

    return success(res, 'Compliance proof rules engine API is healthy.', {
      service: service.SERVICE_NAME,
      sourceOfTruth: 'PostgreSQL',
      blockchainStorage: 'proof-only',
      summary
    });
  } catch (error) {
    return failure(res, error, 'Failed to load compliance proof rules health.');
  }
}

async function summary(req, res) {
  try {
    const data = await service.getSummary();
    return success(res, 'Compliance proof rules summary loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load compliance proof rules summary.');
  }
}

async function rules(req, res) {
  try {
    const data = await service.listRules(req.query);
    return success(res, 'Compliance proof rules loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load compliance proof rules.');
  }
}

async function candidates(req, res) {
  try {
    const data = await service.listCandidates(req.query);
    return success(res, 'Compliance proof rule candidates loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load compliance proof rule candidates.');
  }
}

async function evaluate(req, res) {
  try {
    const data = await service.evaluateAuditEvent(req.params.auditId, {
      ...req.body,
      user: requestUser(req)
    });

    return success(
      res,
      data.dryRun
        ? 'Compliance proof rule dry-run evaluation completed successfully.'
        : 'Compliance proof rules evaluated successfully.',
      data
    );
  } catch (error) {
    return failure(res, error, 'Failed to evaluate compliance proof rules.');
  }
}

async function scan(req, res) {
  try {
    const data = await service.scanAndEvaluate({
      ...req.body,
      user: requestUser(req)
    });

    return success(
      res,
      data.dryRun
        ? 'Compliance proof rule dry-run scan completed successfully.'
        : 'Compliance proof rule scan completed successfully.',
      data
    );
  } catch (error) {
    return failure(res, error, 'Failed to scan compliance proof rules.');
  }
}

async function evaluations(req, res) {
  try {
    const data = await service.listEvaluations(req.query);
    return success(res, 'Compliance proof rule evaluations loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load compliance proof rule evaluations.');
  }
}

module.exports = {
  health,
  summary,
  rules,
  candidates,
  evaluate,
  scan,
  evaluations
};
