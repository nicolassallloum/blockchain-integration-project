'use strict';

/**
 * STEP 28 — Environment Secret Protection
 *
 * This file validates required secrets at startup.
 * It prevents the API from starting with unsafe or missing secrets.
 */

const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'INTERNAL_API_KEY'
];

const weakSecretValues = [
  'secret',
  'password',
  'admin',
  'changeme',
  'change_me',
  'default',
  'test',
  '123456',
  'CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_VALUE'
];

function validateEnvironmentSecrets() {
  const errors = [];

  REQUIRED_ENV_VARS.forEach((key) => {
    const value = process.env[key];

    if (!value) {
      errors.push(`${key} is missing`);
      return;
    }

    if (value.length < 32) {
      errors.push(`${key} must be at least 32 characters`);
    }

    if (weakSecretValues.includes(value.trim())) {
      errors.push(`${key} contains a weak/default value`);
    }
  });

  if (errors.length > 0) {
    console.error('Security environment validation failed:');
    errors.forEach((error) => console.error(`- ${error}`));

    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }

    console.warn(
      'WARNING: Running with insecure environment values because NODE_ENV is not production.'
    );
  }
}

module.exports = {
  validateEnvironmentSecrets
};