const crypto = require('crypto');

function normalizeValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (typeof value === 'object') {
    return canonicalize(value);
  }

  return value;
}

function canonicalize(obj) {
  const sorted = {};

  Object.keys(obj || {})
    .sort()
    .forEach((key) => {
      sorted[key] = normalizeValue(obj[key]);
    });

  return sorted;
}

function sha256(payload) {
  const canonicalPayload = JSON.stringify(canonicalize(payload));

  return crypto
    .createHash('sha256')
    .update(canonicalPayload, 'utf8')
    .digest('hex');
}

function buildAuditEventHashPayload(event) {
  return {
    event_id: event.event_id,
    object: event.source_object,
    action: event.action_type,
    record_pk: event.record_pk,
    changed_by_ip: event.changed_by_ip || event.changed_by || event.ip_address,
    changed_by_user: event.changed_by_user || event.application_user,
    changed_at: event.changed_at,
    old_data_hash: event.old_data_hash || null,
    new_data_hash: event.new_data_hash || null
  };
}

function generateAuditEventHash(event) {
  return sha256(buildAuditEventHashPayload(event));
}

module.exports = {
  canonicalize,
  sha256,
  buildAuditEventHashPayload,
  generateAuditEventHash
};
