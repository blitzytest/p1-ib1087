// @package dotenv v16.0.3
import { config } from 'dotenv';
import { AUTH_CONSTANTS, API_RATE_LIMITS } from '../../../shared/constants';
import { IServiceConfig, ServiceHealth, IRateLimitConfig } from '../types';

// Load environment variables
config();

/**
 * Interface for API Gateway configuration
 */
interface IGatewayConfig {
  port: number;
  env: string;
  corsOrigins: string[];
  rateLimits: {
    auth: IRateLimitConfig;
    accounts: IRateLimitConfig;
    transactions: IRateLimitConfig;
    budgets: IRateLimitConfig;
    investments: IRateLimitConfig;
  };
  security: {
    jwtSecret: string;
    jwtExpiry: number;
    tokenTypes: string[];
    allowedMethods: string[];
    maxRequestSize: string;
  };
}

/**
 * Loads and validates environment variables for API Gateway configuration
 * @throws Error if required environment variables are missing or invalid
 */
export const loadConfig = (): IGatewayConfig => {
  const requiredEnvVars = [
    'PORT',
    'NODE_ENV',
    'CORS_ORIGINS',
    'MAX_REQUEST_SIZE'
  ];

  // Validate required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || [],
    rateLimits: {
      auth: {
        windowMs: API_RATE_LIMITS.AUTH.WINDOW_MINUTES * 60 * 1000,
        max: API_RATE_LIMITS.AUTH.LIMIT,
        burstLimit: API_RATE_LIMITS.AUTH.BURST_ALLOWANCE,
        message: 'Too many authentication attempts',
        statusCode: 429,
        bypassRules: []
      },
      accounts: {
        windowMs: API_RATE_LIMITS.ACCOUNTS.WINDOW_MINUTES * 60 * 1000,
        max: API_RATE_LIMITS.ACCOUNTS.LIMIT,
        burstLimit: API_RATE_LIMITS.ACCOUNTS.BURST_ALLOWANCE,
        message: 'Account operation rate limit exceeded',
        statusCode: 429,
        bypassRules: []
      },
      transactions: {
        windowMs: API_RATE_LIMITS.TRANSACTIONS.WINDOW_MINUTES * 60 * 1000,
        max: API_RATE_LIMITS.TRANSACTIONS.LIMIT,
        burstLimit: API_RATE_LIMITS.TRANSACTIONS.BURST_ALLOWANCE,
        message: 'Transaction operation rate limit exceeded',
        statusCode: 429,
        bypassRules: []
      },
      budgets: {
        windowMs: API_RATE_LIMITS.BUDGETS.WINDOW_MINUTES * 60 * 1000,
        max: API_RATE_LIMITS.BUDGETS.LIMIT,
        burstLimit: API_RATE_LIMITS.BUDGETS.BURST_ALLOWANCE,
        message: 'Budget operation rate limit exceeded',
        statusCode: 429,
        bypassRules: []
      },
      investments: {
        windowMs: API_RATE_LIMITS.INVESTMENTS.WINDOW_MINUTES * 60 * 1000,
        max: API_RATE_LIMITS.INVESTMENTS.LIMIT,
        burstLimit: API_RATE_LIMITS.INVESTMENTS.BURST_ALLOWANCE,
        message: 'Investment operation rate limit exceeded',
        statusCode: 429,
        bypassRules: []
      }
    },
    security: {
      jwtSecret: AUTH_CONSTANTS.JWT_SECRET,
      jwtExpiry: AUTH_CONSTANTS.JWT_EXPIRY,
      tokenTypes: ['Bearer'],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb'
    }
  };
};

/**
 * Validates service configuration including health check settings
 * @param config Service configuration to validate
 * @returns boolean indicating if configuration is valid
 */
const validateServiceConfig = (config: IServiceConfig): boolean => {
  if (!config.baseUrl || !/^https?:\/\//.test(config.baseUrl)) {
    return false;
  }

  if (!config.healthCheck || 
      !config.healthCheck.endpoint || 
      config.healthCheck.interval < 5000 || 
      config.healthCheck.timeout < 1000) {
    return false;
  }

  return true;
};

/**
 * Service routing and health check configuration for microservices
 */
export const serviceConfig: Record<string, IServiceConfig> = {
  auth: {
    baseUrl: process.env.AUTH_SERVICE_URL || 'http://auth-service:4001',
    endpoints: {
      login: '/auth/login',
      register: '/auth/register',
      verify: '/auth/verify',
      refresh: '/auth/refresh',
      logout: '/auth/logout'
    },
    timeout: 5000,
    healthCheck: {
      endpoint: '/health',
      interval: 15000,
      timeout: 3000
    },
    validation: {
      patterns: {},
      rules: {}
    }
  },
  accounts: {
    baseUrl: process.env.ACCOUNTS_SERVICE_URL || 'http://accounts-service:4002',
    endpoints: {
      list: '/accounts',
      create: '/accounts',
      update: '/accounts/:id',
      delete: '/accounts/:id',
      sync: '/accounts/:id/sync'
    },
    timeout: 10000,
    healthCheck: {
      endpoint: '/health',
      interval: 15000,
      timeout: 3000
    },
    validation: {
      patterns: {},
      rules: {}
    }
  },
  transactions: {
    baseUrl: process.env.TRANSACTIONS_SERVICE_URL || 'http://transactions-service:4003',
    endpoints: {
      list: '/transactions',
      details: '/transactions/:id',
      categorize: '/transactions/:id/categorize',
      search: '/transactions/search'
    },
    timeout: 15000,
    healthCheck: {
      endpoint: '/health',
      interval: 15000,
      timeout: 3000
    },
    validation: {
      patterns: {},
      rules: {}
    }
  },
  budgets: {
    baseUrl: process.env.BUDGETS_SERVICE_URL || 'http://budgets-service:4004',
    endpoints: {
      list: '/budgets',
      create: '/budgets',
      update: '/budgets/:id',
      delete: '/budgets/:id',
      alerts: '/budgets/alerts'
    },
    timeout: 8000,
    healthCheck: {
      endpoint: '/health',
      interval: 15000,
      timeout: 3000
    },
    validation: {
      patterns: {},
      rules: {}
    }
  },
  investments: {
    baseUrl: process.env.INVESTMENTS_SERVICE_URL || 'http://investments-service:4005',
    endpoints: {
      portfolio: '/investments/portfolio',
      holdings: '/investments/holdings',
      transactions: '/investments/transactions',
      performance: '/investments/performance'
    },
    timeout: 12000,
    healthCheck: {
      endpoint: '/health',
      interval: 15000,
      timeout: 3000
    },
    validation: {
      patterns: {},
      rules: {}
    }
  }
};

// Validate all service configurations
Object.entries(serviceConfig).forEach(([service, config]) => {
  if (!validateServiceConfig(config)) {
    throw new Error(`Invalid configuration for service: ${service}`);
  }
});

// Export gateway configuration
export const gatewayConfig = loadConfig();