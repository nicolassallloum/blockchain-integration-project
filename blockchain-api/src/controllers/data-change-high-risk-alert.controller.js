const service = require('../services/data-change-high-risk-alert.service');

function success(res, message, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

function failure(res, error, fallbackMessage = 'High-risk data change alert request failed') {
  const statusCode = Number(error.statusCode || error.status || 500);

  return res.status(statusCode).json({
    success: false,
    message: error.message || fallbackMessage,
    code: error.code || 'HIGH_RISK_DATA_CHANGE_ALERT_ERROR',
    timestamp: new Date().toISOString()
  });
}

function requestUser(req) {
  return (
    req.body?.user ||
    req.body?.createdBy ||
    req.user?.username ||
    req.user?.email ||
    req.headers['x-user'] ||
    service.SERVICE_NAME
  );
}

async function health(req, res) {
  try {
    const summary = await service.getSummary();

    return success(res, 'High-risk data change alert API is healthy.', {
      service: service.SERVICE_NAME,
      summary
    });
  } catch (error) {
    return failure(res, error, 'Failed to load high-risk alert health.');
  }
}

async function summary(req, res) {
  try {
    const data = await service.getSummary();
    return success(res, 'High-risk data change alert summary loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load high-risk alert summary.');
  }
}

async function scan(req, res) {
  try {
    const data = await service.scanAndCreateAlerts({
      ...req.query,
      ...req.body,
      dryRun: req.body?.dryRun === true || req.query?.dryRun === 'true',
      createdBy: requestUser(req)
    });

    return success(
      res,
      data.dryRun
        ? 'High-risk data change alert dry run completed successfully.'
        : 'High-risk data change alerts generated successfully.',
      data,
      data.created ? 201 : 200
    );
  } catch (error) {
    return failure(res, error, 'Failed to scan high-risk data change alerts.');
  }
}

async function list(req, res) {
  try {
    const data = await service.listAlerts(req.query);
    return success(res, 'High-risk data change alerts loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load high-risk data change alerts.');
  }
}

async function detail(req, res) {
  try {
    const data = await service.getAlert(req.params.alertIdOrKey);
    return success(res, 'High-risk data change alert loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load high-risk data change alert.');
  }
}

async function updateStatus(req, res) {
  try {
    const data = await service.updateAlertStatus(req.params.alertIdOrKey, {
      ...req.body,
      user: requestUser(req)
    });

    return success(res, 'High-risk data change alert status updated successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to update high-risk data change alert status.');
  }
}

module.exports = {
  health,
  summary,
  scan,
  list,
  detail,
  updateStatus
};
