'use strict';

const crypto = require('crypto');

/**
 * Generate blockchain-style wallet address.
 *
 * Example:
 * fe43dce35bdf18108fa5b0b9788858df518c36ff
 *
 * Rules:
 * - 40 characters
 * - lowercase hexadecimal
 * - no 0x prefix
 */
function generateWalletAddress() {
  return crypto.randomBytes(20).toString('hex');
}

function isValidWalletAddress(walletAddress) {
  return /^[a-f0-9]{40}$/.test(String(walletAddress || ''));
}

module.exports = {
  generateWalletAddress,
  isValidWalletAddress
};
