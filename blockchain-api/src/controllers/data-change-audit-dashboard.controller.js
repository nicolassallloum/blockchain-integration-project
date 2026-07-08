const service = require('../services/data-change-audit-dashboard.service');

function success(res, message, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

function failure(res, error, fallbackMessage = 'Data change audit dashboard request failed') {
  const statusCode = Number(error.statusCode || error.status || 500);

  console.error('[DATA_CHANGE_AUDIT_DASHBOARD_ERROR]', error);

  return res.status(statusCode).json({
    success: false,
    message: error.message || fallbackMessage,
    code: error.code || 'DATA_CHANGE_AUDIT_DASHBOARD_ERROR',
    timestamp: new Date().toISOString()
  });
}

function getRequestRole(req) {
  return (
    req.user?.role ||
    req.user?.userRole ||
    req.headers['x-user-role'] ||
    req.headers['x-audit-role'] ||
    req.query.requestRole ||
    req.query.currentRole ||
    ''
  );
}

function shouldAllowSensitiveRows(req) {
  const includeSensitiveRows = String(req.query.includeSensitiveRows || '').toLowerCase() === 'true';
  return includeSensitiveRows && service.roleAllowsSensitiveRows(getRequestRole(req));
}

async function health(req, res) {
  try {
    return success(res, 'Data change audit dashboard API is healthy.', {
      service: 'data-change-audit-dashboard',
      sourceOfTruth: 'PostgreSQL',
      blockchainStorage: 'proof-only',
      sensitiveRowsDefault: 'redacted'
    });
  } catch (error) {
    return failure(res, error, 'Failed to load data change audit dashboard health.');
  }
}

async function metrics(req, res) {
  try {
    const data = await service.getMetrics(req.query);
    return success(res, 'Data change audit dashboard metrics loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load data change audit dashboard metrics.');
  }
}

async function list(req, res) {
  try {
    const data = await service.listAuditEvents(req.query);
    return success(res, 'Data change audit events loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load data change audit events.');
  }
}

async function detail(req, res) {
  try {
    const data = await service.getAuditEventDetail(req.params.auditId, {
      allowSensitiveRows: shouldAllowSensitiveRows(req)
    });

    return success(res, 'Data change audit event detail loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load data change audit event detail.');
  }
}

async function dashboard(req, res) {
  try {
    const data = await service.getDashboard(req.query);
    return success(res, 'Data change audit dashboard loaded successfully.', data);
  } catch (error) {
    return failure(res, error, 'Failed to load data change audit dashboard.');
  }
}


async function exportReport(req, res) {
  try {
    const data = await service.getAuditExportReport({
      ...req.query,
      includeSensitiveRows: shouldAllowSensitiveRows(req)
    });

    res.setHeader('Content-Type', data.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${data.fileName}"`);
    res.setHeader('X-Data-Change-Audit-Export-Format', data.format);
    res.setHeader('X-Data-Change-Audit-Row-Count', String(data.metadata?.rowCount || 0));

    return res.status(200).send(data.content);
  } catch (error) {
    return failure(res, error, 'Failed to export data change audit evidence report.');
  }
}


module.exports = {
  health,
  metrics,
  list,
  detail,
  dashboard,
  exportReport
};
