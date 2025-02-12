/**
 * Redux middleware for handling API requests in the Mint Clone application
 * Implements comprehensive request lifecycle management, caching, and error handling
 * @version 1.0.0
 */

import { Middleware } from '@reduxjs/toolkit';
import winston from 'winston'; // ^3.8.2
import CircuitBreaker from 'opossum'; // ^6.0.0
import RequestCache from 'memory-cache'; // ^0.2.0
import { api } from '../../services/api';
import { STORAGE_KEYS } from '../../utils/storage';

// Action types for API requests
export const API_REQUEST = Symbol('API_REQUEST');
export const API_SUCCESS = Symbol('API_SUCCESS');
export const API_ERROR = Symbol('API_ERROR');

// Constants
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'api-errors.log', level: 'error' })
  ]
});

// Configure circuit breaker
const breaker = new CircuitBreaker(handleApiRequest, {
  timeout: REQUEST_TIMEOUT,
  resetTimeout: 30000,
  errorThresholdPercentage: 50,
  volumeThreshold: 10
});

// Request cache instance
const requestCache = new RequestCache();

/**
 * Custom API error class
 */
export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * API request metadata interface
 */
interface ApiRequestMetadata {
  url: string;
  method: string;
  body?: any;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
  cacheDuration?: number;
  retryCount?: number;
}

/**
 * Creates the API middleware instance
 */
export const createApiMiddleware = (): Middleware => {
  return store => next => async action => {
    // Skip non-API actions
    if (!action.type || action.type !== API_REQUEST) {
      return next(action);
    }

    const { payload, meta } = action;
    const requestMeta: ApiRequestMetadata = meta || {};

    try {
      // Check cache for GET requests
      if (requestMeta.method === 'GET' && requestMeta.cacheDuration) {
        const cachedResponse = requestCache.get(requestMeta.url);
        if (cachedResponse) {
          return next({
            type: API_SUCCESS,
            payload: cachedResponse,
            meta: requestMeta
          });
        }
      }

      // Execute request through circuit breaker
      const response = await breaker.fire(payload, requestMeta);

      // Cache successful GET responses
      if (requestMeta.method === 'GET' && requestMeta.cacheDuration) {
        requestCache.put(requestMeta.url, response, requestMeta.cacheDuration);
      }

      // Dispatch success action
      return next({
        type: API_SUCCESS,
        payload: response,
        meta: requestMeta
      });

    } catch (error) {
      // Log error
      logger.error('API Request Failed', {
        url: requestMeta.url,
        method: requestMeta.method,
        error: error.message,
        stack: error.stack
      });

      // Handle error with retry logic
      const result = await handleApiError(error, payload, requestMeta, store);

      // Dispatch error action
      return next({
        type: API_ERROR,
        error: true,
        payload: result,
        meta: requestMeta
      });
    }
  };
};

/**
 * Handles API requests with authentication and optimization
 */
async function handleApiRequest(payload: any, meta: ApiRequestMetadata): Promise<any> {
  const { url, method, body, headers = {}, requiresAuth = true } = meta;

  // Add auth token if required
  if (requiresAuth) {
    const token = await api.auth.validateToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  // Add performance tracking headers
  headers['X-Request-Start'] = Date.now().toString();

  // Make API request
  const response = await api[method.toLowerCase()](url, {
    ...body,
    headers,
    timeout: REQUEST_TIMEOUT
  });

  return response.data;
}

/**
 * Handles API errors with retry mechanism
 */
async function handleApiError(
  error: any,
  payload: any,
  meta: ApiRequestMetadata,
  store: any
): Promise<any> {
  const retryCount = meta.retryCount || 0;

  // Handle authentication errors
  if (error.response?.status === 401) {
    try {
      // Attempt token refresh
      const newToken = await api.auth.refreshToken();
      if (newToken) {
        // Retry original request with new token
        return await handleApiRequest(payload, {
          ...meta,
          headers: {
            ...meta.headers,
            Authorization: `Bearer ${newToken}`
          }
        });
      }
    } catch (refreshError) {
      throw new ApiError('AUTH_REFRESH_FAILED', 'Authentication refresh failed');
    }
  }

  // Implement retry logic for retryable errors
  if (retryCount < MAX_RETRIES && isRetryableError(error)) {
    const nextRetryDelay = Math.pow(2, retryCount) * 1000;
    await new Promise(resolve => setTimeout(resolve, nextRetryDelay));

    return await handleApiRequest(payload, {
      ...meta,
      retryCount: retryCount + 1
    });
  }

  throw new ApiError(
    error.code || 'API_ERROR',
    error.message || 'An unexpected error occurred'
  );
}

/**
 * Determines if an error is retryable
 */
function isRetryableError(error: any): boolean {
  return (
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT' ||
    error.response?.status >= 500 ||
    error.response?.status === 429
  );
}

// Export configured middleware
export const apiMiddleware = createApiMiddleware();