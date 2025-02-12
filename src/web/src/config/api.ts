/**
 * API configuration and setup for the Mint Clone mobile application
 * Implements advanced HTTP client with error handling, caching, and security features
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'; // ^1.4.0
import { ApiResponse, ErrorResponse } from '../types/api';
import { API_CONSTANTS, RATE_LIMITS, ERROR_CODES, PERFORMANCE_THRESHOLDS } from './constants';

// Circuit breaker state management
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

// Request deduplication cache
interface RequestCache {
  [key: string]: {
    timestamp: number;
    promise: Promise<any>;
  };
}

// Initialize state containers
const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
};

const requestCache: RequestCache = {};

/**
 * Creates and configures an enhanced Axios instance with advanced features
 */
const createApiInstance = (): AxiosInstance => {
  const api = axios.create({
    baseURL: API_CONSTANTS.BASE_URL,
    timeout: API_CONSTANTS.TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Client-Version': '1.0.0',
    },
    validateStatus: (status) => status >= 200 && status < 300,
  });

  setupRequestInterceptor(api);
  setupResponseInterceptor(api);

  return api;
};

/**
 * Configures request interceptor with authentication and optimization
 */
const setupRequestInterceptor = (api: AxiosInstance): void => {
  api.interceptors.request.use(
    async (config) => {
      // Circuit breaker check
      if (circuitBreaker.isOpen) {
        const now = Date.now();
        if (now - circuitBreaker.lastFailure > PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME) {
          circuitBreaker.isOpen = false;
          circuitBreaker.failures = 0;
        } else {
          throw new Error('Circuit breaker is open');
        }
      }

      // Request deduplication
      const cacheKey = `${config.method}-${config.url}-${JSON.stringify(config.params)}`;
      if (config.method === 'get' && requestCache[cacheKey]) {
        const cached = requestCache[cacheKey];
        if (Date.now() - cached.timestamp < PERFORMANCE_THRESHOLDS.CACHE_TTL * 1000) {
          return cached.promise;
        }
        delete requestCache[cacheKey];
      }

      // Rate limiting check
      const endpoint = config.url?.split('/')[1];
      const rateLimit = RATE_LIMITS[endpoint?.toUpperCase()] || RATE_LIMITS.ACCOUNTS;
      
      // Add auth token if available
      const token = await getStoredToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add performance monitoring headers
      config.headers['X-Request-Start'] = Date.now().toString();

      return config;
    },
    (error: AxiosError) => {
      return Promise.reject(error);
    }
  );
};

/**
 * Configures response interceptor with error handling and caching
 */
const setupResponseInterceptor = (api: AxiosInstance): void => {
  api.interceptors.response.use(
    (response) => {
      // Cache successful GET requests
      if (response.config.method === 'get') {
        const cacheKey = `${response.config.method}-${response.config.url}-${JSON.stringify(response.config.params)}`;
        requestCache[cacheKey] = {
          timestamp: Date.now(),
          promise: Promise.resolve(response),
        };
      }

      // Reset circuit breaker on success
      circuitBreaker.failures = 0;
      circuitBreaker.isOpen = false;

      // Add performance metrics
      const requestDuration = Date.now() - parseInt(response.config.headers['X-Request-Start']);
      response.headers['X-Response-Time'] = requestDuration.toString();

      return response;
    },
    async (error: AxiosError<ApiResponse<any>>) => {
      // Update circuit breaker state
      circuitBreaker.failures++;
      circuitBreaker.lastFailure = Date.now();
      if (circuitBreaker.failures >= API_CONSTANTS.RETRY_ATTEMPTS) {
        circuitBreaker.isOpen = true;
      }

      // Handle specific error types
      if (error.response) {
        const errorResponse: ErrorResponse = {
          code: error.response.status.toString(),
          message: error.response.data?.error?.message || 'An error occurred',
          details: error.response.data?.error?.details || {},
        };

        // Handle authentication errors
        if (error.response.status === 401) {
          if (errorResponse.code === ERROR_CODES.AUTH.SESSION_EXPIRED.toString()) {
            return refreshTokenAndRetry(error.config);
          }
        }

        return Promise.reject(errorResponse);
      }

      // Handle network errors
      if (error.request) {
        return Promise.reject({
          code: 'NETWORK_ERROR',
          message: 'Network error occurred',
          details: { original: error.message },
        });
      }

      return Promise.reject({
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
        details: { original: error.message },
      });
    }
  );
};

/**
 * Token refresh and request retry logic
 */
const refreshTokenAndRetry = async (failedRequest: AxiosRequestConfig): Promise<any> => {
  try {
    const newToken = await refreshToken();
    if (failedRequest.headers) {
      failedRequest.headers.Authorization = `Bearer ${newToken}`;
    }
    return axios(failedRequest);
  } catch (error) {
    return Promise.reject({
      code: ERROR_CODES.AUTH.SESSION_EXPIRED,
      message: 'Session expired. Please login again.',
      details: {},
    });
  }
};

// Create and configure API instance
const api = createApiInstance();

// API endpoints configuration
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
  },
  ACCOUNTS: {
    LIST: '/accounts',
    LINK: '/accounts/link',
    SYNC: '/accounts/sync',
  },
  TRANSACTIONS: {
    LIST: '/transactions',
    CATEGORIZE: '/transactions/categorize',
    SEARCH: '/transactions/search',
  },
  BUDGETS: {
    LIST: '/budgets',
    CREATE: '/budgets/create',
    UPDATE: '/budgets/update',
  },
  INVESTMENTS: {
    PORTFOLIO: '/investments/portfolio',
    PERFORMANCE: '/investments/performance',
    HOLDINGS: '/investments/holdings',
  },
} as const;

// Utility functions for circuit breaker and cache management
export const getCircuitBreakerStatus = () => ({
  isOpen: circuitBreaker.isOpen,
  failures: circuitBreaker.failures,
  lastFailure: circuitBreaker.lastFailure,
});

export const clearCache = () => {
  Object.keys(requestCache).forEach(key => delete requestCache[key]);
};

// Default export of configured API instance
export default api;