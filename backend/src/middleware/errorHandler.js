function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || (err.name === "ZodError" ? 400 : 500);
  const message = err.name === "ZodError"
    ? err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")
    : err.message || "Internal server error";

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
