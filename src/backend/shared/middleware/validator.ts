/**
 * Enhanced request validation middleware using Zod schemas
 * Provides robust input validation with security features and internationalization
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { z, ZodError, ZodSchema } from 'zod'; // v3.22.0
import i18next from 'i18next'; // v23.0.0
import { IErrorResponse } from '../interfaces';
import { validateEmail, validatePassword, validateAmount } from '../utils/validator';

// Cache for compiled schemas to improve performance
const schemaCache = new Map<string, ZodSchema>();

// Validation options interface
interface ValidationOptions {
  sanitize?: boolean;
  trackMetrics?: boolean;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

// Rate limiting tracker
const rateLimitTracker = new Map<string, { count: number; resetTime: number }>();

/**
 * Enhanced validation middleware factory with caching and performance optimization
 * @param schema - Zod schema for request validation
 * @param source - Request source to validate (body, query, params)
 * @param options - Validation options for customization
 * @returns Express middleware function
 */
export const validateRequest = (
  schema: ZodSchema,
  source: 'body' | 'query' | 'params',
  options: ValidationOptions = {}
) => {
  // Cache schema for reuse
  const cacheKey = schema.toString();
  if (!schemaCache.has(cacheKey)) {
    schemaCache.set(cacheKey, schema);
  }

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = options.trackMetrics ? Date.now() : 0;

      // Apply rate limiting if configured
      if (options.rateLimit) {
        const clientIp = req.ip;
        const tracker = rateLimitTracker.get(clientIp) || { count: 0, resetTime: Date.now() + options.rateLimit.windowMs };

        if (Date.now() > tracker.resetTime) {
          tracker.count = 0;
          tracker.resetTime = Date.now() + options.rateLimit.windowMs;
        }

        if (tracker.count >= options.rateLimit.maxRequests) {
          throw new Error('TOO_MANY_REQUESTS');
        }

        tracker.count++;
        rateLimitTracker.set(clientIp, tracker);
      }

      // Get data from request based on source
      const data = req[source];

      // Sanitize input if enabled
      const sanitizedData = options.sanitize ? sanitizeInput(data) : data;

      // Validate against cached schema
      const validatedData = await schemaCache.get(cacheKey)!.parseAsync(sanitizedData);

      // Track validation metrics if enabled
      if (options.trackMetrics) {
        const duration = Date.now() - startTime;
        // Implement metric tracking logic here
      }

      // Attach validated data to request
      req[source] = validatedData;
      next();

    } catch (error) {
      const errorResponse = handleValidationError(error);
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  };
};

/**
 * Enhanced authentication validation middleware with MFA support
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const validateAuthRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, mfaToken } = req.body;

    // Validate email
    const emailValidation = validateEmail(email);
    if (emailValidation !== true) {
      throw emailValidation;
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (passwordValidation !== true) {
      throw passwordValidation;
    }

    // Validate MFA token if provided
    if (mfaToken && typeof mfaToken !== 'string') {
      throw {
        message: 'Invalid MFA token format',
        statusCode: 400,
        errorCode: 1005
      };
    }

    next();
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
};

/**
 * Enhanced transaction validation middleware with decimal precision
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const validateTransactionRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { amount, category, description } = req.body;

    // Validate amount
    const amountValidation = validateAmount(amount);
    if (amountValidation !== true) {
      throw amountValidation;
    }

    // Validate category
    if (!category || typeof category !== 'string') {
      throw {
        message: 'Invalid transaction category',
        statusCode: 400,
        errorCode: 3004
      };
    }

    // Validate description
    if (description && typeof description !== 'string') {
      throw {
        message: 'Invalid transaction description',
        statusCode: 400,
        errorCode: 3005
      };
    }

    next();
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(errorResponse.statusCode).json(errorResponse);
  }
};

/**
 * Sanitizes input data to prevent XSS and injection attacks
 * @param data - Input data to sanitize
 * @returns Sanitized data
 */
const sanitizeInput = (data: any): any => {
  if (typeof data === 'string') {
    return data
      .replace(/[<>]/g, '') // Remove < and > characters
      .trim();
  } else if (Array.isArray(data)) {
    return data.map(item => sanitizeInput(item));
  } else if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return data;
};

/**
 * Handles validation errors with internationalization support
 * @param error - Error object from validation
 * @returns Standardized error response
 */
const handleValidationError = (error: any): IErrorResponse => {
  if (error instanceof ZodError) {
    return {
      message: i18next.t('validation.invalid_input'),
      statusCode: 400,
      errorCode: 1000,
      timestamp: new Date(),
      path: '',
      details: error.errors
    };
  }

  if (error.message === 'TOO_MANY_REQUESTS') {
    return {
      message: i18next.t('validation.rate_limit_exceeded'),
      statusCode: 429,
      errorCode: 1006,
      timestamp: new Date(),
      path: '',
      details: {}
    };
  }

  return {
    ...error,
    timestamp: new Date(),
    path: '',
    details: {}
  };
};