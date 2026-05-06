const successResponse = ({
  res,
  statusCode = 200,
  message = "Success",
  data = null,
  meta = null
}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta,
    timestamp: new Date().toISOString()
  });
};

const errorResponse = ({
  res,
  statusCode = 500,
  message = "Internal Server Error",
  errors = null
}) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  successResponse,
  errorResponse
};
