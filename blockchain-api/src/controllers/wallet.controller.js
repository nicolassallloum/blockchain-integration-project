const walletService = require("../services/wallet.service");

function buildSuccessResponse(message, data = null, meta = null) {
  return {
    success: true,
    message,
    data,
    meta,
    timestamp: new Date().toISOString()
  };
}

function buildErrorResponse(message, errorCode = "WALLET_CREATION_ERROR", details = null) {
  return {
    success: false,
    message,
    error: {
      code: errorCode,
      details
    },
    timestamp: new Date().toISOString()
  };
}

function validateCreateWalletPayload(body) {
  const errors = [];

  if (!body.customerId) errors.push("customerId is required");
  if (!body.organizationId) errors.push("organizationId is required");
  if (!body.fullName) errors.push("fullName is required");
  if (!body.nationalIdHash) errors.push("nationalIdHash is required");
  if (!body.mobileHash) errors.push("mobileHash is required");
  if (!body.emailHash) errors.push("emailHash is required");
  if (!body.passwordHash) errors.push("passwordHash is required");

  if (body.initialBalance !== undefined && isNaN(Number(body.initialBalance))) {
    errors.push("initialBalance must be numeric");
  }

  return errors;
}

exports.createWallet = async (req, res) => {
  try {
    const validationErrors = validateCreateWalletPayload(req.body);

    if (validationErrors.length > 0) {
      return res.status(400).json(
        buildErrorResponse(
          "Wallet creation validation failed",
          "VALIDATION_ERROR",
          validationErrors
        )
      );
    }

    const result = await walletService.createWallet({
      customerId: req.body.customerId,
      organizationId: req.body.organizationId,
      fullName: req.body.fullName,
      nationalIdHash: req.body.nationalIdHash,
      mobileHash: req.body.mobileHash,
      emailHash: req.body.emailHash,
      passwordHash: req.body.passwordHash,
      initialBalance: req.body.initialBalance || "0",
      requestSource: req.body.requestSource || "API",
      createdBy: req.body.createdBy || "SYSTEM",
      metadata: req.body.metadata || {},
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    return res.status(201).json(
      buildSuccessResponse(
        "Wallet created successfully",
        result
      )
    );
  } catch (error) {
    console.error("Create wallet error:", error);

    return res.status(error.statusCode || 500).json(
      buildErrorResponse(
        error.message || "Failed to create wallet",
        error.code || "INTERNAL_SERVER_ERROR",
        error.details || null
      )
    );
  }
};
