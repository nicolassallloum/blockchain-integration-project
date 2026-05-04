const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
const JWT_ISSUER = process.env.JWT_ISSUER || "blockchain-api-middleware";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "blockchain-wallet-users";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required in environment variables");
}

function generateWalletToken(wallet) {
  const payload = {
    sub: wallet.wallet_address,
    walletAddress: wallet.wallet_address,
    customerId: wallet.customer_id,
    organizationId: wallet.organization_id,
    organizationCode: wallet.organization_code || null,
    role: "WALLET_USER",
    tokenType: "WALLET_LOGIN"
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  });
}

function verifyWalletToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  });
}

module.exports = {
  generateWalletToken,
  verifyWalletToken
};
