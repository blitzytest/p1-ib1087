import { Platform } from 'react-native'; // v0.71+

// Global constants
export const APP_VERSION = '1.0.0';
export const BUILD_NUMBER = '1';
export const IS_DEV = process.env.NODE_ENV === 'development';

// API configuration constants
export const API_CONSTANTS = {
  BASE_URL: IS_DEV ? 'http://localhost:3000/api' : 'https://api.mintclone.com/api',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  MAX_CONCURRENT_REQUESTS: 10
} as const;

// API rate limits as per A.1.3 API Rate Limits
export const RATE_LIMITS = {
  AUTH: {
    requests: 5,
    window: '1m',
    burst: 0
  },
  ACCOUNTS: {
    requests: 30,
    window: '1m',
    burst: 5
  },
  TRANSACTIONS: {
    requests: 100,
    window: '1m',
    burst: 20
  },
  INVESTMENTS: {
    requests: 50,
    window: '1m',
    burst: 10
  }
} as const;

// Data retention periods as per A.1.1
export const DATA_RETENTION = {
  TRANSACTION_HISTORY: {
    period: 7,
    unit: 'years'
  },
  USER_ACTIVITY: {
    period: 1,
    unit: 'year'
  },
  ERROR_LOGS: {
    period: 30,
    unit: 'days'
  },
  ANALYTICS_DATA: {
    period: 2,
    unit: 'years'
  }
} as const;

// Input validation rules
export const VALIDATION_RULES = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  AMOUNT_PATTERN: /^\d+(\.\d{0,2})?$/
} as const;

// Feature flags for gradual rollout
export const FEATURE_FLAGS = {
  ENABLE_BIOMETRICS: Platform.select({
    ios: true,
    android: true,
    default: false
  }),
  ENABLE_PUSH_NOTIFICATIONS: true,
  ENABLE_ANALYTICS: !IS_DEV,
  ENABLE_INVESTMENT_FEATURES: true
} as const;

// Plaid integration configuration
export const PLAID_CONFIG = {
  ENV: IS_DEV ? 'sandbox' : 'production',
  PRODUCTS: ['auth', 'transactions', 'investments'],
  COUNTRY_CODES: ['US'],
  TIMEOUT: 30000 // 30 seconds
} as const;

// Error codes
export const ERROR_CODES = {
  AUTH: {
    INVALID_CREDENTIALS: 1001,
    SESSION_EXPIRED: 1002,
    MFA_REQUIRED: 1003
  },
  ACCOUNT: {
    CONNECTION_FAILED: 2001,
    SYNC_FAILED: 2002,
    INVALID_CREDENTIALS: 2003
  },
  TRANSACTION: {
    SYNC_FAILED: 3001,
    INVALID_DATA: 3002,
    PROCESSING_ERROR: 3003
  }
} as const;

// Performance thresholds based on system requirements
export const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE_TIME: 3000, // 3 seconds
  UPTIME_TARGET: 99.9,
  CACHE_TTL: 300, // 5 minutes
  STALE_DATA_THRESHOLD: 900 // 15 minutes
} as const;