// @package dotenv v16.0.3
import { config } from 'dotenv';

// Load environment variables
config();

// Type definitions
type ErrorRange = {
  readonly MIN: number;
  readonly MAX: number;
};

type RateLimit = {
  readonly LIMIT: number;
  readonly WINDOW_MINUTES: number;
  readonly BURST_ALLOWANCE: number;
};

type PlaidEnvironment = 'sandbox' | 'development' | 'production';

// Validate environment configuration
const validateEnvironment = (): void => {
  const requiredEnvVars = [
    'JWT_SECRET',
    'JWT_EXPIRY',
    'PLAID_CLIENT_ID',
    'PLAID_SECRET',
    'PLAID_ENV'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  // Validate JWT expiry is a number
  if (isNaN(Number(process.env.JWT_EXPIRY))) {
    throw new Error('JWT_EXPIRY must be a valid number');
  }

  // Validate Plaid environment
  const validPlaidEnvs: PlaidEnvironment[] = ['sandbox', 'development', 'production'];
  if (!validPlaidEnvs.includes(process.env.PLAID_ENV as PlaidEnvironment)) {
    throw new Error('Invalid PLAID_ENV value');
  }
};

validateEnvironment();

// Authentication Constants
export const AUTH_CONSTANTS = {
  JWT_SECRET: process.env.JWT_SECRET as string,
  JWT_EXPIRY: Number(process.env.JWT_EXPIRY),
  REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60, // 7 days in seconds
  MFA_CODE_LENGTH: 6,
  MFA_CODE_EXPIRY: 10 * 60, // 10 minutes in seconds
  PASSWORD_HASH_ROUNDS: 12
} as const;

// HTTP Status Codes
export enum HTTP_STATUS {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500
}

// Error Code Ranges
export const ERROR_CODES = {
  AUTH_ERROR_RANGE: {
    MIN: 1000,
    MAX: 1999
  },
  ACCOUNT_ERROR_RANGE: {
    MIN: 2000,
    MAX: 2999
  },
  TRANSACTION_ERROR_RANGE: {
    MIN: 3000,
    MAX: 3999
  },
  BUDGET_ERROR_RANGE: {
    MIN: 4000,
    MAX: 4999
  },
  INVESTMENT_ERROR_RANGE: {
    MIN: 5000,
    MAX: 5999
  }
} as const;

// API Rate Limits
export const API_RATE_LIMITS = {
  AUTH: {
    LIMIT: 5,
    WINDOW_MINUTES: 1,
    BURST_ALLOWANCE: 0
  },
  ACCOUNTS: {
    LIMIT: 30,
    WINDOW_MINUTES: 1,
    BURST_ALLOWANCE: 5
  },
  TRANSACTIONS: {
    LIMIT: 100,
    WINDOW_MINUTES: 1,
    BURST_ALLOWANCE: 20
  },
  INVESTMENTS: {
    LIMIT: 50,
    WINDOW_MINUTES: 1,
    BURST_ALLOWANCE: 10
  },
  BUDGETS: {
    LIMIT: 30,
    WINDOW_MINUTES: 1,
    BURST_ALLOWANCE: 5
  }
} as const;

// Plaid Configuration
export const PLAID_CONFIG = {
  CLIENT_ID: process.env.PLAID_CLIENT_ID as string,
  SECRET: process.env.PLAID_SECRET as string,
  ENV: process.env.PLAID_ENV as PlaidEnvironment,
  PRODUCTS: ['auth', 'transactions', 'investments'] as const,
  COUNTRY_CODES: ['US'] as const
} as const;

// Service-specific Constants
export const SERVICE_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  CACHE_TTL: 5 * 60, // 5 minutes in seconds
  REQUEST_TIMEOUT: 30000, // 30 seconds in milliseconds
  MAX_BATCH_SIZE: 50
} as const;

// Validation Constants
export const VALIDATION_CONSTANTS = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 50,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^\+?[1-9]\d{1,14}$/
} as const;