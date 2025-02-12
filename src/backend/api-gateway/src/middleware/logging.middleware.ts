import { Request, Response, NextFunction } from 'express'; // v4.18.2
import morgan from 'morgan'; // v1.10.0
import onFinished from 'on-finished'; // v2.4.1
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { Logger } from '../../../shared/utils/logger';

// Initialize logger with ELK Stack integration and 1-year retention
const logger = new Logger('api-gateway', {
  logLevel: 'info',
  enableConsole: true,
  enableFile: true,
  logPath: 'logs/api-gateway',
  elkFormat: true,
  maskFields: ['password', 'token', 'secret', 'authorization', 'cookie', 'x-api-key']
});

// Performance monitoring threshold (100ms as per technical spec)
const PERFORMANCE_THRESHOLD_MS = 100;

// Headers that should have values masked in logs
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key'];

/**
 * Express middleware for comprehensive request/response logging
 * Implements performance monitoring and error tracking
 */
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate unique request ID for tracing
  const requestId = uuidv4();
  const startTime = process.hrtime.bigint();

  // Add request ID to response headers for client-side tracking
  res.setHeader('x-request-id', requestId);

  // Log incoming request details
  logRequest(req, requestId);

  // Handle response logging on request completion
  onFinished(res, (err) => {
    if (err) {
      logger.error('Request processing error', {
        requestId,
        error: err.message,
        stack: err.stack
      });
    }
    logResponse(res, requestId, startTime);
  });

  // Error handling for uncaught errors
  const originalEnd = res.end;
  res.end = function(...args: any[]): void {
    if (res.statusCode >= 500) {
      logger.error('Server error in request processing', {
        requestId,
        statusCode: res.statusCode,
        path: req.path
      });
    }
    originalEnd.apply(res, args);
  };

  next();
}

/**
 * Formats and logs incoming request details with sensitive data masking
 */
function logRequest(req: Request, requestId: string): void {
  const {
    method,
    path,
    query,
    headers,
    body
  } = req;

  // Deep clone headers and mask sensitive data
  const sanitizedHeaders = maskSensitiveData(
    { ...headers },
    SENSITIVE_HEADERS
  );

  // Format request body with size limits
  const sanitizedBody = body ? maskSensitiveData(
    JSON.parse(JSON.stringify(body)),
    ['password', 'token']
  ) : undefined;

  // Log request details
  logger.info('Incoming request', {
    requestId,
    method,
    path,
    query,
    headers: sanitizedHeaders,
    body: sanitizedBody,
    userAgent: req.get('user-agent'),
    ip: req.ip
  });
}

/**
 * Formats and logs response details with performance metrics
 */
function logResponse(
  res: Response,
  requestId: string,
  startTime: bigint
): void {
  const endTime = process.hrtime.bigint();
  const responseTimeMs = Number(endTime - startTime) / 1_000_000;

  // Check if response time exceeds threshold
  if (responseTimeMs > PERFORMANCE_THRESHOLD_MS) {
    logger.warn('Response time exceeded threshold', {
      requestId,
      responseTimeMs,
      threshold: PERFORMANCE_THRESHOLD_MS
    });
  }

  // Get response details
  const {
    statusCode,
    statusMessage
  } = res;

  // Log response with performance metrics
  logger.info('Response completed', {
    requestId,
    statusCode,
    statusMessage,
    responseTimeMs,
    headers: maskSensitiveData(res.getHeaders(), SENSITIVE_HEADERS)
  });

  // Track response metrics for monitoring
  if (statusCode >= 400) {
    logger.error('Request failed', {
      requestId,
      statusCode,
      path: (res as any).req?.path,
      responseTimeMs
    });
  }
}

/**
 * Masks sensitive information in request/response data
 */
function maskSensitiveData(
  data: object,
  sensitiveFields: string[]
): object {
  const masked = JSON.parse(JSON.stringify(data));

  const maskValue = (obj: any) => {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        maskValue(obj[key]);
      } else if (sensitiveFields.includes(key.toLowerCase())) {
        obj[key] = '***MASKED***';
      }
    }
  };

  maskValue(masked);
  return masked;
}