const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 12;

async function hashSecret(secret) {
  if (!secret || typeof secret !== "string") {
    throw new Error("Secret value is required");
  }

  return bcrypt.hash(secret, SALT_ROUNDS);
}

async function compareSecret(plainValue, hashedValue) {
  if (!plainValue || !hashedValue) {
    return false;
  }

  return bcrypt.compare(plainValue, hashedValue);
}

module.exports = {
  hashSecret,
  compareSecret
};
