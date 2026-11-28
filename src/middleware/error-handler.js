export function errorHandler(error, _req, res, _next) {
  const statusCode =
    Number.isInteger(error?.status) &&
    error.status >= 400 &&
    error.status <= 599
      ? error.status
      : 500;

  if (statusCode === 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    error: statusCode === 500 ? "Internal server error" : error.message,
    field: error?.field || undefined,
  });
}
