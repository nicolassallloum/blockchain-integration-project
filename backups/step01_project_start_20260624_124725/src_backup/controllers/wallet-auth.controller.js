const walletAuthService = require("../services/wallet-auth.service");

async function loginWallet(req, res) {
  const meta = {
    ip:
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      null,
    userAgent: req.headers["user-agent"] || null
  };

  const result = await walletAuthService.loginWallet(req.body, meta);

  return res.status(result.statusCode).json(result.body);
}

module.exports = {
  loginWallet
};
