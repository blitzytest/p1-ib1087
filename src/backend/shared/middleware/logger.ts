import { Request, Response, NextFunction } from 'express'; // v4.18.2
import morgan from 'morgan'; // v1.10.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { Logger } from '../utils/logger';
import { IErrorResponse } from '../interfaces';
import { HTTP_STATUS } from '../constants';

// Initialize logger instance for middleware
const logger = new Logger('http-middleware', {
  elkFormat: true,
  logLevel: 'info',
  maskFields: ['password', 'token', 'authorization', 'cookie']
});

// Sampling rate for high-traffic scenarios
const LOG_SAMPLE_RATE = 1.0; // Log 100% of requests in production

// Log buffer size for batch processing
const LOG_BUFFER_SIZE = 100;
const logBuffer: any[] = [];

/**
 * Custom morgan token for request ID correlation
 */
morgan.token('request-id', (req: Request) => {
  return req.requestId || '-';
});

/**
 * Custom morgan token for response time in ms
 */
morgan.token('response-time-ms', (req: Request, res: Response) => {
  if (!req.startTime) return '-';
  const duration = process.hrtime(req.startTime);
  return (duration[0] * 1000 + duration[1] / 1e6).toFixed(3);
});

/**
 * Format log entry for ELK Stack integration
 */
const formatLogEntry = (req: Request, res: Response, error?: Error) => {
  const logEntry = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    status: res.statusCode,
    userAgent: req.get('user-agent'),
    ip: req.ip,
    responseTime: res.getHeader('X-Response-Time'),
    service: process.env.SERVICE_NAME || 'unknown',
    timestamp: new Date().toISOString(),
    error: error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : undefined
  };

  return logEntry;
};

/**
 * Process buffered logs in batch
 */
const processLogBuffer = () => {
  if (logBuffer.length === 0) return;

  const batch = logBuffer.splice(0, logBuffer.length);
  logger.info('Request batch logs', { 
    count: batch.length,
    logs: batch 
  });
};

// Setup batch processing interval
setInterval(processLogBuffer, 5000);

/**
 * Express middleware for request logging with ELK Stack integration
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Skip logging based on sampling rate
  if (Math.random() > LOG_SAMPLE_RATE) {
    return next();
  }

  // Generate unique request ID
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);

  // Record request start time
  req.startTime = process.hrtime();

  // Setup morgan logging
  morgan(':request-id [:date[iso]] ":method :url" :status :response-time-ms ms', {
    stream: {
      write: (message: string) => {
        const logEntry = formatLogEntry(req, res);
        
        if (logBuffer.length >= LOG_BUFFER_SIZE) {
          processLogBuffer();
        }
        
        logBuffer.push(logEntry);
      }
    }
  })(req, res, () => {});

  // Log request body if present (excluding sensitive data)
  if (req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = { ...req.body };
    // Mask sensitive fields
    ['password', 'token', 'secret'].forEach(field => {
      if (field in sanitizedBody) {
        sanitizedBody[field] = '***MASKED***';
      }
    });
    
    logger.info('Request body', { 
      requestId: req.requestId,
      body: sanitizedBody 
    });
  }

  // Override response end to capture response data
  const originalEnd = res.end;
  res.end = function(chunk?: any, ...rest: any[]): Response {
    // Calculate response time
    const responseTime = process.hrtime(req.startTime);
    const timeInMs = (responseTime[0] * 1000 + responseTime[1] / 1e6).toFixed(3);
    res.setHeader('X-Response-Time', timeInMs);

    // Log response
    const logEntry = formatLogEntry(req, res);
    if (chunk) {
      try {
        const body = chunk.toString();
        if (body && body.length < 10000) { // Don't log large responses
          logEntry.responseBody = JSON.parse(body);
        }
      } catch (e) {
        // Response body is not JSON or is too large
      }
    }

    if (logBuffer.length >= LOG_BUFFER_SIZE) {
      processLogBuffer();
    }
    logBuffer.push(logEntry);

    return originalEnd.call(this, chunk, ...rest);
  };

  next();
};

/**
 * Express middleware for error logging with enhanced tracking
 */
export const errorLogger = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  const errorResponse: IErrorResponse = {
    message: error.message || 'Internal Server Error',
    statusCode: error instanceof Error ? (error as any).statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR : HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode: (error as any).errorCode || 5000,
    errorType: error.name,
    timestamp: new Date(),
    path: req.originalUrl || req.url,
    details: {
      requestId: req.requestId,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent')
    }
  };

  // Log error with full context
  logger.error('Request error', {
    error: errorResponse,
    stack: error.stack,
    requestId: req.requestId
  });

  // Pass error to next handler
  next(error);
};