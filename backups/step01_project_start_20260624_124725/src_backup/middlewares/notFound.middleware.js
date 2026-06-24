const { errorResponse } = require("../utils/apiResponse");

const notFoundMiddleware = (req, res) => {
  return errorResponse({
    res,
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

module.exports = notFoundMiddleware;
