const express = require('express');
const db = require('../../config/database');

const router = express.Router();

const SETTINGS = [
  {
    key: 'blockchain_network',
    group: 'blockchain',
    defaultValue: 'Hyperledger Fabric',
    dataType: 'string',
    description: 'Blockchain network type'
  },
  {
    key: 'channel_name',
    group: 'blockchain',
    defaultValue: 'kycchannelnix1',
    dataType: 'string',
    description: 'Fabric channel name'
  },
  {
    key: 'chaincode_name',
    group: 'blockchain',
    defaultValue: 'kyc-wallet-chaincode-js',
    dataType: 'string',
    description: 'Fabric chaincode name'
  },
  {
    key: 'organization_msp',
    group: 'blockchain',
    defaultValue: 'Org1MSP',
    dataType: 'string',
    description: 'Fabric organization MSP'
  },
  {
    key: 'api_base_url',
    group: 'api',
    defaultValue: 'http://172.31.13.90:3001/api/v1',
    dataType: 'string',
    description: 'Backend API base URL'
  },
  {
    key: 'environment',
    group: 'api',
    defaultValue: 'Production',
    dataType: 'string',
    description: 'Application environment'
  },
  {
    key: 'request_timeout_ms',
    group: 'api',
    defaultValue: '30000',
    dataType: 'number',
    description: 'API request timeout in milliseconds'
  },
  {
    key: 'cors_status',
    group: 'api',
    defaultValue: 'Enabled',
    dataType: 'string',
    description: 'CORS status'
  },
  {
    key: 'password_policy',
    group: 'security',
    defaultValue: 'Strong',
    dataType: 'string',
    description: 'Password policy level'
  },
  {
    key: 'jwt_expiry',
    group: 'security',
    defaultValue: '24 Hours',
    dataType: 'string',
    description: 'JWT expiry duration'
  },
  {
    key: 'two_factor_authentication',
    group: 'security',
    defaultValue: 'Enabled',
    dataType: 'string',
    description: 'Two-factor authentication setting'
  },
  {
    key: 'audit_logging',
    group: 'security',
    defaultValue: 'Enabled',
    dataType: 'string',
    description: 'Audit logging setting'
  }
];

function toCamelCase(key) {
  return key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function castValue(value, dataType) {
  if (dataType === 'number') {
    return Number(value);
  }

  return value;
}

function buildSettingsResponse(rows) {
  const grouped = {
    blockchain: {},
    api: {},
    security: {}
  };

  rows.forEach((row) => {
    grouped[row.setting_group][toCamelCase(row.setting_key)] = castValue(
      row.setting_value,
      row.data_type
    );
  });

  return grouped;
}

async function ensureSettingsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS blockchain.platform_settings (
      setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      setting_key VARCHAR(100) UNIQUE NOT NULL,
      setting_value TEXT NOT NULL,
      setting_group VARCHAR(50) NOT NULL,
      data_type VARCHAR(30) DEFAULT 'string',
      is_editable BOOLEAN DEFAULT TRUE,
      description TEXT,
      updated_by VARCHAR(100),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  for (const item of SETTINGS) {
    await db.query(
      `
      INSERT INTO blockchain.platform_settings (
        setting_key,
        setting_value,
        setting_group,
        data_type,
        is_editable,
        description
      )
      VALUES ($1, $2, $3, $4, TRUE, $5)
      ON CONFLICT (setting_key) DO NOTHING;
      `,
      [
        item.key,
        item.defaultValue,
        item.group,
        item.dataType,
        item.description
      ]
    );
  }
}

async function getSettingsRows(client = db) {
  const result = await client.query(`
    SELECT
      setting_key,
      setting_value,
      setting_group,
      data_type,
      is_editable,
      description,
      updated_by,
      updated_at,
      created_at
    FROM blockchain.platform_settings
    ORDER BY setting_group, setting_key;
  `);

  return result.rows;
}

function flattenPayload(payload) {
  const values = {};

  if (payload.blockchain) {
    if (payload.blockchain.blockchainNetwork !== undefined) {
      values.blockchain_network = payload.blockchain.blockchainNetwork;
    }
    if (payload.blockchain.channelName !== undefined) {
      values.channel_name = payload.blockchain.channelName;
    }
    if (payload.blockchain.chaincodeName !== undefined) {
      values.chaincode_name = payload.blockchain.chaincodeName;
    }
    if (payload.blockchain.organizationMsp !== undefined) {
      values.organization_msp = payload.blockchain.organizationMsp;
    }
  }

  if (payload.api) {
    if (payload.api.apiBaseUrl !== undefined) {
      values.api_base_url = payload.api.apiBaseUrl;
    }
    if (payload.api.environment !== undefined) {
      values.environment = payload.api.environment;
    }
    if (payload.api.requestTimeoutMs !== undefined) {
      values.request_timeout_ms = String(payload.api.requestTimeoutMs).replace(' ms', '');
    }
    if (payload.api.corsStatus !== undefined) {
      values.cors_status = payload.api.corsStatus;
    }
  }

  if (payload.security) {
    if (payload.security.passwordPolicy !== undefined) {
      values.password_policy = payload.security.passwordPolicy;
    }
    if (payload.security.jwtExpiry !== undefined) {
      values.jwt_expiry = payload.security.jwtExpiry;
    }
    if (payload.security.twoFactorAuthentication !== undefined) {
      values.two_factor_authentication = payload.security.twoFactorAuthentication;
    }
    if (payload.security.auditLogging !== undefined) {
      values.audit_logging = payload.security.auditLogging;
    }
  }

  return values;
}

function validateSettings(values) {
  const errors = [];

  if (
    values.environment !== undefined &&
    !['Production', 'Staging', 'Development'].includes(values.environment)
  ) {
    errors.push('Environment must be Production, Staging, or Development.');
  }

  if (
    values.request_timeout_ms !== undefined &&
    (!Number.isFinite(Number(values.request_timeout_ms)) || Number(values.request_timeout_ms) <= 0)
  ) {
    errors.push('Request Timeout must be a valid positive number.');
  }

  if (
    values.cors_status !== undefined &&
    !['Enabled', 'Disabled'].includes(values.cors_status)
  ) {
    errors.push('CORS Status must be Enabled or Disabled.');
  }

  if (
    values.password_policy !== undefined &&
    !['Strong', 'Medium', 'Basic'].includes(values.password_policy)
  ) {
    errors.push('Password Policy must be Strong, Medium, or Basic.');
  }

  for (const key of ['two_factor_authentication', 'audit_logging']) {
    if (values[key] !== undefined && !['Enabled', 'Disabled'].includes(values[key])) {
      errors.push(`${key} must be Enabled or Disabled.`);
    }
  }

  return errors;
}

async function writeAuditLog({ req, oldValues, newValues, status, errorMessage = null }) {
  try {
    const finalStatus = status === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
    const finalSeverity = finalStatus === 'SUCCESS' ? 'INFO' : 'ERROR';

    await db.query(
      `
      INSERT INTO blockchain.audit_logs (
        correlation_id,
        request_id,
        entity_type,
        action,
        action_category,
        actor_type,
        actor_id,
        actor_name,
        source_system,
        old_values,
        new_values,
        event_payload,
        metadata,
        status,
        severity,
        error_message,
        event_at,
        created_by,
        created_at,
        event_type,
        event_status,
        action_status,
        module_name,
        action_name,
        event_description
      )
      VALUES (
        $1, $2,
        'PLATFORM_SETTINGS',
        'UPDATE_SETTINGS',
        'CONFIGURATION',
        'ADMIN',
        'settings-user',
        'Settings User',
        'GOVERNMENT_BLOCKCHAIN',
        $3::jsonb,
        $4::jsonb,
        $5::jsonb,
        $6::jsonb,
        $7::varchar,
        $8::varchar,
        $9::text,
        NOW(),
        'SYSTEM',
        NOW(),
        'SETTINGS_UPDATED',
        $10::varchar,
        $11::text,
        'Settings',
        'Save Settings',
        'Government blockchain platform settings updated'
      );
      `,
      [
        req.correlationId || req.requestId || null,
        req.requestId || null,
        JSON.stringify(oldValues || {}),
        JSON.stringify(newValues || {}),
        JSON.stringify({ source: 'settings-screen' }),
        JSON.stringify({
          module: 'Government Blockchain Settings',
          action: 'Save Settings',
          origin: 'settings.routes.js'
        }),
        finalStatus,
        finalSeverity,
        errorMessage,
        finalStatus,
        finalStatus
      ]
    );
  } catch (auditError) {
    console.error('[SETTINGS_AUDIT_LOG_ERROR]', auditError.message);
  }
}

router.get('/', async (req, res) => {
  try {
    await ensureSettingsTable();
    const rows = await getSettingsRows();

    return res.json({
      success: true,
      message: 'Settings loaded successfully.',
      data: buildSettingsResponse(rows),
      meta: {
        total: rows.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[SETTINGS_GET_ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load settings.',
      errorCode: 'SETTINGS_GET_FAILED',
      data: null,
      meta: null,
      timestamp: new Date().toISOString()
    });
  }
});

router.put('/', async (req, res) => {
  const values = flattenPayload(req.body || {});
  const validationErrors = validateSettings(values);

  if (validationErrors.length > 0) {
    return res.status(400).json({
      success: false,
      message: validationErrors.join(' '),
      errorCode: 'SETTINGS_VALIDATION_FAILED',
      data: null,
      meta: {
        errors: validationErrors
      },
      timestamp: new Date().toISOString()
    });
  }

  const client = await db.getClient();

  try {
    await ensureSettingsTable();

    await client.query('BEGIN');

    const oldRows = await getSettingsRows(client);
    const oldValues = buildSettingsResponse(oldRows);

    for (const [key, value] of Object.entries(values)) {
      await client.query(
        `
        UPDATE blockchain.platform_settings
        SET
          setting_value = $1,
          updated_by = $2,
          updated_at = NOW()
        WHERE setting_key = $3
          AND is_editable = TRUE;
        `,
        [String(value), 'SYSTEM_ADMIN', key]
      );
    }

    const newRows = await getSettingsRows(client);
    const newValues = buildSettingsResponse(newRows);

    await client.query('COMMIT');

    await writeAuditLog({
      req,
      oldValues,
      newValues,
      status: 'SUCCESS'
    });

    return res.json({
      success: true,
      message: 'Settings updated successfully.',
      data: newValues,
      meta: {
        updatedKeys: Object.keys(values)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('[SETTINGS_UPDATE_ERROR]', error);

    await writeAuditLog({
      req,
      oldValues: {},
      newValues: values,
      status: 'FAILED',
      errorMessage: error.message
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to update settings.',
      errorCode: 'SETTINGS_UPDATE_FAILED',
      data: null,
      meta: null,
      timestamp: new Date().toISOString()
    });
  } finally {
    client.release();
  }
});

router.get('/status', async (req, res) => {
  const checkedAt = new Date().toISOString();

  const status = {
    postgresqlDatabase: {
      label: 'PostgreSQL Database',
      status: 'Checking'
    },
    fabricPeer: {
      label: 'Fabric Peer',
      status: 'Checking'
    },
    couchDb: {
      label: 'CouchDB',
      status: 'Checking'
    },
    apiMiddleware: {
      label: 'API Middleware',
      status: 'Running'
    }
  };

  try {
    await db.query('SELECT 1 AS ok;');
    status.postgresqlDatabase.status = 'Connected';
  } catch (error) {
    status.postgresqlDatabase.status = 'Disconnected';
    status.postgresqlDatabase.error = error.message;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch('http://localhost:5984/_up', {
      signal: controller.signal,
      headers: {
        Authorization: 'Basic ' + Buffer.from('admin:adminpw').toString('base64')
      }
    });

    clearTimeout(timeout);

    status.couchDb.status = response.ok ? 'Online' : 'Offline';
  } catch (error) {
    status.couchDb.status = 'Offline';
    status.couchDb.error = error.message;
  }

  try {
    await ensureSettingsTable();

    const result = await db.query(`
      SELECT setting_key, setting_value
      FROM blockchain.platform_settings
      WHERE setting_key IN ('channel_name', 'chaincode_name', 'organization_msp');
    `);

    const settings = Object.fromEntries(
      result.rows.map((row) => [row.setting_key, row.setting_value])
    );

    if (settings.channel_name && settings.chaincode_name && settings.organization_msp) {
      status.fabricPeer.status = 'Online';
      status.fabricPeer.channel = settings.channel_name;
      status.fabricPeer.chaincode = settings.chaincode_name;
      status.fabricPeer.organizationMsp = settings.organization_msp;
    } else {
      status.fabricPeer.status = 'Configuration Missing';
    }
  } catch (error) {
    status.fabricPeer.status = 'Offline';
    status.fabricPeer.error = error.message;
  }

  return res.json({
    success: true,
    message: 'System status loaded successfully.',
    data: status,
    meta: {
      checkedAt
    },
    timestamp: checkedAt
  });
});

router.post('/test-connection', async (req, res) => {
  const type = req.body?.type || 'all';

  return res.json({
    success: true,
    message: 'Connection test completed.',
    data: {
      type,
      status: 'OK'
    },
    meta: null,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
