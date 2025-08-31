import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  logger.error(err.stack);

  if (err.response) {
    // API error from external service
    return res.status(err.response.status || 500).json({
      error: err.response.data?.message || err.message,
      service: err.config?.baseURL
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.details
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
