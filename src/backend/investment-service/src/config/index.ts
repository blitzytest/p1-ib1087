// @package dotenv v16.0.3
import { config } from 'dotenv';
import { ERROR_CODES } from '../../../shared/constants';
import { IInvestment } from '../../../shared/interfaces';

// Load environment variables
config();

// Investment Types Constants
export const INVESTMENT_TYPES = {
  STOCK: 'stock',
  BOND: 'bond',
  MUTUAL_FUND: 'mutual_fund',
  ETF: 'etf'
} as const;

// Performance Metrics Constants
export const PERFORMANCE_METRICS = {
  UPDATE_TIMEOUT: 5000, // 5 seconds max for updates per SLA
  CACHE_TTL: 300, // 5 minutes cache TTL
  BATCH_SIZE: 50, // Maximum batch size for investment updates
  REFRESH_INTERVAL: 900, // 15 minutes refresh interval
  MAX_RETRIES: 3 // Maximum retry attempts
} as const;

// Validate configuration settings
const validateConfig = (): void => {
  const requiredEnvVars = [
    'INVESTMENT_SERVICE_PORT',
    'NODE_ENV',
    'DB_CONNECTION_STRING',
    'REDIS_URL',
    'ENCRYPTION_KEY',
    'LOG_LEVEL',
    'METRICS_ENABLED'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  // Validate port number
  if (isNaN(Number(process.env.INVESTMENT_SERVICE_PORT))) {
    throw new Error('Invalid port number');
  }
};

validateConfig();

// Export configuration object
export const config = {
  port: Number(process.env.INVESTMENT_SERVICE_PORT),
  env: process.env.NODE_ENV as string,
  serviceName: 'investment-service',

  // Database configuration
  database: {
    url: process.env.DB_CONNECTION_STRING as string,
    poolSize: 10,
    timeout: 5000,
    retryAttempts: 3,
    ssl: process.env.NODE_ENV === 'production'
  },

  // Redis configuration for caching
  redis: {
    url: process.env.REDIS_URL as string,
    ttl: PERFORMANCE_METRICS.CACHE_TTL,
    maxConnections: 50,
    keyPrefix: 'inv:'
  },

  // Security configuration
  security: {
    encryptionKey: process.env.ENCRYPTION_KEY as string,
    errorCodes: {
      min: ERROR_CODES.INVESTMENT_ERROR_RANGE.MIN,
      max: ERROR_CODES.INVESTMENT_ERROR_RANGE.MAX
    },
    dataMasking: ['value', 'costBasis'],
    auditLog: true
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    timestamps: true,
    errorLogging: {
      separate: true,
      maxFiles: 30,
      maxSize: '100m'
    }
  },

  // Performance metrics configuration
  metrics: {
    enabled: process.env.METRICS_ENABLED === 'true',
    updateTimeout: PERFORMANCE_METRICS.UPDATE_TIMEOUT,
    refreshInterval: PERFORMANCE_METRICS.REFRESH_INTERVAL,
    batchSize: PERFORMANCE_METRICS.BATCH_SIZE,
    maxRetries: PERFORMANCE_METRICS.MAX_RETRIES,
    thresholds: {
      cpuWarning: 70,
      cpuCritical: 85,
      memoryWarning: 75,
      memoryCritical: 90
    }
  },

  // Rate limiting configuration
  rateLimit: {
    window: 60000, // 1 minute
    max: 50, // 50 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    burstAllowance: 10
  },

  // Backup configuration
  backup: {
    enabled: true,
    schedule: '0 0 * * *', // Daily at midnight
    retention: 30, // 30 days
    compression: true,
    encryptBackups: true
  }
} as const;