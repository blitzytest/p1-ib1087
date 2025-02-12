// @package express-rate-limit v6.7.0
// @package rate-limit-redis v3.0.0
// @package ioredis v5.3.0
// @package express v4.18.2

import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';
import { Request, Response } from 'express';
import { gatewayConfig } from '../config';
import { IErrorResponse } from '../../../shared/interfaces';

// Initialize Redis client for distributed rate limiting
const redisClient = new Redis(gatewayConfig.redisConfig);

/**
 * Creates a rate limiting middleware with configurable options
 * @param options Rate limiting configuration options
 * @returns Configured rate limiting middleware
 */
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  burstMax?: number;
  bypassKey?: string;
  endpoint?: string;
}) => {
  const store = new RedisStore({
    prefix: `ratelimit:${options.endpoint || 'default'}:`,
    // Sliding window with Redis
    sendCommand: (...args: string[]) => redisClient.call(...args),
  });

  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    skip: (req) => {
      // Skip rate limiting if bypass key is present and valid
      return options.bypassKey ? req.get('X-API-Key') === options.bypassKey : false;
    },
    keyGenerator: (req) => {
      // Use IP + User ID if authenticated, otherwise just IP
      const ip = req.ip || req.connection.remoteAddress || '';
      const userId = (req as any).userId;
      return userId ? `${ip}:${userId}` : ip;
    },
    handler: (req: Request, res: Response) => handleRateLimitExceeded(req, res),
    // Support burst allowance if specified
    ...options.burstMax && {
      max: (req: Request): number => {
        const currentCount = parseInt(req.get('X-RateLimit-Remaining') || '0', 10);
        return currentCount === 0 ? options.burstMax! : options.max;
      }
    }
  });
};

/**
 * Enhanced handler for rate limit exceeded events
 * @param req Express request object
 * @param res Express response object
 */
const handleRateLimitExceeded = (req: Request, res: Response): void => {
  const retryAfter = parseInt(res.get('Retry-After') || '60', 10);

  const errorResponse: IErrorResponse = {
    message: 'Rate limit exceeded. Please try again later.',
    statusCode: 429,
    errorCode: 4290,
    timestamp: new Date(),
    path: req.path,
    details: {
      retryAfter,
      limit: req.get('X-RateLimit-Limit'),
      remaining: 0,
      reset: req.get('X-RateLimit-Reset')
    }
  };

  // Log rate limit event
  console.warn(`Rate limit exceeded for ${req.ip} on ${req.path}`);

  res.status(429).json(errorResponse);
};

// Public API rate limiter (100 requests/minute)
export const publicApiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  burstMax: 120,
  endpoint: 'public'
});

// Authenticated API rate limiter (1000 requests/minute)
export const authenticatedApiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 1000,
  burstMax: 1200,
  endpoint: 'authenticated'
});

// Export factory function for custom rate limiters
export { createRateLimiter };