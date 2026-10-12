import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { HttpError } from '../utils/httpError.js';

export function errorHandler(error, _req, res, _next) {
  const isHttpError = error instanceof HttpError;
  const statusCode = isHttpError ? error.statusCode : error.status || 500;

  if (statusCode >= 500) {
    logger.error(error.stack || error.message);
  }

  const message =
    statusCode >= 500 && env.isProduction ? 'Internal server error' : error.message || 'Unexpected error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(isHttpError && error.details ? { details: error.details } : {}),
  });
}
