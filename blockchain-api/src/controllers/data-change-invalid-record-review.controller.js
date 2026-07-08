const service = require('../services/data-change-invalid-record-review.service');

function success(res, message, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

function failure(res, error, fallbackMessage = 'Invalid record review request failed') {
  const statusCode = Number(error.statusCode || error.status || 500);

  return res.status(statusCode).json({
    success: false,
    message: error.message || fallbackMessage,
    code: error.code || 'INVALID_RECORD_REVIEW_ERROR',
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

    return success(res, 'Invalid record review API is healthy.', {
      service: service.SERVICE_NAME,
      sourceOfTruth: 'PostgreSQL',
      blockchainStorage: 'proof-only',
      summary
    });
  } catch (error) {
    return failure(res, error, 'Failed to load invalid record review health.');
  }
}

async function summary(req, res) {
  try {
    const data = await service.getSummary();
    return success(res, 'Invalid record review summary loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load invalid record review summary.');
  }
}

async function candidates(req, res) {
  try {
    const data = await service.listCandidates(req.query);
    return success(res, 'Invalid record review candidates loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load invalid record review candidates.');
  }
}

async function list(req, res) {
  try {
    const data = await service.listReviews(req.query);
    return success(res, 'Invalid record reviews loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load invalid record reviews.');
  }
}

async function detail(req, res) {
  try {
    const data = await service.getReview(req.params.reviewIdOrKey);
    return success(res, 'Invalid record review loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load invalid record review.');
  }
}

async function open(req, res) {
  try {
    const data = await service.openReview({
      ...req.body,
      user: requestUser(req)
    });

    return success(
      res,
      data.dryRun
        ? 'Invalid record review dry run completed successfully.'
        : 'Invalid record review opened successfully.',
      data,
      data.created ? 201 : 200
    );
  } catch (error) {
    return failure(res, error, 'Failed to open invalid record review.');
  }
}

async function approveCorrection(req, res) {
  try {
    const data = await service.approveCorrectedVersion(req.params.reviewIdOrKey, {
      ...req.body,
      user: requestUser(req)
    });

    return success(res, 'Corrected version approved successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to approve corrected version.');
  }
}

async function markNewProofSubmitted(req, res) {
  try {
    const data = await service.markNewProofSubmitted(req.params.reviewIdOrKey, {
      ...req.body,
      user: requestUser(req)
    });

    return success(res, 'New corrected proof submission recorded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to record new proof submission.');
  }
}

async function reactivate(req, res) {
  try {
    const data = await service.reactivateRecord(req.params.reviewIdOrKey, {
      ...req.body,
      user: requestUser(req)
    });

    return success(res, 'Invalid record reactivated successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to reactivate invalid record.');
  }
}

async function rejectReactivation(req, res) {
  try {
    const data = await service.rejectReactivation(req.params.reviewIdOrKey, {
      ...req.body,
      user: requestUser(req)
    });

    return success(res, 'Invalid record reactivation rejected successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to reject invalid record reactivation.');
  }
}

async function close(req, res) {
  try {
    const data = await service.closeReview(req.params.reviewIdOrKey, {
      ...req.body,
      user: requestUser(req)
    });

    return success(res, 'Invalid record review closed successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to close invalid record review.');
  }
}

module.exports = {
  health,
  summary,
  candidates,
  list,
  detail,
  open,
  approveCorrection,
  markNewProofSubmitted,
  reactivate,
  rejectReactivation,
  close
};
