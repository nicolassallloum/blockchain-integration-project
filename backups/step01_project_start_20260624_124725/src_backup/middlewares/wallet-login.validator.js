function validateWalletLoginRequest(req, res, next) {
  const { walletAddress, customerId, password, pin } = req.body || {};

  const hasWalletAddress = walletAddress && typeof walletAddress === "string";
  const hasCustomerId = customerId && typeof customerId === "string";

  if (!hasWalletAddress && !hasCustomerId) {
    return res.status(400).json({
      success: false,
      message: "walletAddress or customerId is required",
      errorCode: "VALIDATION_ERROR",
      data: null
    });
  }

  if (!password || typeof password !== "string") {
    return res.status(400).json({
      success: false,
      message: "password is required",
      errorCode: "VALIDATION_ERROR",
      data: null
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Invalid login credentials",
      errorCode: "INVALID_CREDENTIALS",
      data: null
    });
  }

  if (pin && typeof pin !== "string") {
    return res.status(400).json({
      success: false,
      message: "pin must be a string",
      errorCode: "VALIDATION_ERROR",
      data: null
    });
  }

  req.body.walletAddress = walletAddress ? walletAddress.trim() : undefined;
  req.body.customerId = customerId ? customerId.trim() : undefined;

  next();
}

module.exports = {
  validateWalletLoginRequest
};
