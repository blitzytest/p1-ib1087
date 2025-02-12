import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { BaseError, formatError, isOperationalError } from '../errors';
import { Logger } from '../utils/logger';

// Initialize logger for error handling
const logger = new Logger('ErrorHandler', {
  logLevel: 'error',
  elkFormat: true,
  maskFields: ['password', 'token', 'secret']
});

/**
 * Express error handling middleware that processes errors and sends standardized responses
 * Implements comprehensive error tracking, logging, and monitoring integration
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate correlation ID for error tracking
  const correlationId = req.headers['x-correlation-id'] || 
    `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Extract request context for logging
  const context = {
    correlationId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: (req as any).user?.id,
    body: req.body,
    query: req.query,
    params: req.params
  };

  // Determine error severity and log appropriately
  if (error instanceof BaseError) {
    logger.error(error, {
      ...context,
      errorCode: error.errorCode,
      statusCode: error.statusCode
    });
  } else {
    logger.fatal(error, context);
  }

  // Format error response
  const formattedError = formatError(error);

  // Sanitize error message in production
  if (process.env.NODE_ENV === 'production' && !isOperationalError(error)) {
    formattedError.message = 'Internal Server Error';
  }

  // Set response status
  const statusCode = error instanceof BaseError ? error.statusCode : 500;

  // Send error response
  res.status(statusCode).json({
    ...formattedError,
    correlationId,
    path: req.path
  });

  // Track error metrics for monitoring
  if (!isOperationalError(error)) {
    // Increment critical error counter in monitoring system
    process.emit('metric', {
      name: 'critical_errors',
      value: 1,
      tags: {
        errorCode: formattedError.errorCode,
        path: req.path
      }
    });
  }
};

/**
 * Process-level handler for uncaught exceptions
 * Implements graceful shutdown procedure with connection cleanup
 */
export const handleUncaughtException = (error: Error): void => {
  logger.fatal('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    type: 'UncaughtException'
  });

  // Alert monitoring systems
  process.emit('metric', {
    name: 'uncaught_exception',
    value: 1,
    tags: { type: error.name }
  });

  // Start graceful shutdown
  const shutdownTimeout = 10000; // 10 seconds
  let shuttingDown = false;

  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;

    // Stop accepting new requests
    if (global.server) {
      global.server.close(() => {
        logger.info('HTTP server closed');
      });
    }

    // Close database connections
    if (global.db) {
      global.db.disconnect().catch((err: Error) => {
        logger.error('Error disconnecting from database', { error: err });
      });
    }

    // Exit process with error code
    setTimeout(() => {
      process.exit(1);
    }, shutdownTimeout);
  };

  shutdown();
};

/**
 * Process-level handler for unhandled promise rejections
 * Converts rejections to exceptions for consistent error handling
 */
export const handleUnhandledRejection = (
  error: Error
): void => {
  logger.error('Unhandled Promise Rejection', {
    error: error.message,
    stack: error.stack,
    type: 'UnhandledRejection'
  });

  // Track unhandled rejection metrics
  process.emit('metric', {
    name: 'unhandled_rejection',
    value: 1,
    tags: { type: error.name }
  });

  // Convert to uncaught exception
  throw error;
};

// Register process-level error handlers
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);