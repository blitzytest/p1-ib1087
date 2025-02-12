import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { BaseError, formatError, isOperationalError } from '../../../shared/errors';
import { Logger } from '../../../shared/utils/logger';

// Initialize logger for API Gateway
const logger = new Logger('api-gateway');

/**
 * Centralized error handling middleware for API Gateway
 * Processes errors, formats responses, and integrates with monitoring systems
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Extract error details
  const baseError = error instanceof BaseError ? error : new BaseError(
    error.message || 'Internal Server Error',
    500,
    5000
  );

  // Log error with appropriate severity and context
  const logContext = {
    path: req.path,
    method: req.method,
    requestId: req.headers['x-request-id'],
    errorCode: baseError.errorCode,
    stack: error.stack,
    details: (baseError as any).details || {}
  };

  // Determine error severity and log accordingly
  if (isOperationalError(error)) {
    logger.warn(baseError.message, logContext);
  } else {
    logger.error(baseError.message, logContext);
  }

  // Validate error code against defined ranges
  const errorRanges = {
    authentication: [1000, 1999],
    account: [2000, 2999],
    transaction: [3000, 3999],
    budget: [4000, 4999],
    investment: [5000, 5999]
  };

  // Format error response
  const errorResponse = formatError(baseError);

  // Set appropriate HTTP status code
  const statusCode = baseError.statusCode || 500;

  // For non-operational errors, trigger monitoring alert
  if (!isOperationalError(error)) {
    // Log critical error for monitoring systems
    logger.error('Critical error detected', {
      ...logContext,
      alert: true,
      severity: 'CRITICAL'
    });
  }

  // Send formatted error response
  res.status(statusCode).json(errorResponse);

  // Log error handling completion
  logger.debug('Error handling completed', {
    errorCode: baseError.errorCode,
    statusCode,
    path: req.path
  });
};

/**
 * Middleware for handling 404 Not Found errors
 * Generates standardized response for unmatched routes
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Create standardized 404 error
  const notFoundError = new BaseError(
    `Route not found: ${req.method} ${req.path}`,
    404,
    1404 // Using authentication error range for routing errors
  );

  // Log not found error
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    requestId: req.headers['x-request-id']
  });

  // Format and send error response
  const errorResponse = formatError(notFoundError);
  res.status(404).json(errorResponse);
};