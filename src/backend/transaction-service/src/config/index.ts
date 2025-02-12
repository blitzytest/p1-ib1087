// @package dotenv v16.0.3
import { config } from 'dotenv';
import { ERROR_CODES } from '../../../shared/constants';

// Load environment variables
config();

// Validate required environment variables
const validateEnvVariables = (): void => {
  const required = [
    'NODE_ENV',
    'PORT',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'LOG_LEVEL',
    'LOG_FORMAT'
  ];

  for (const variable of required) {
    if (!process.env[variable]) {
      throw new Error(`Missing required environment variable: ${variable}`);
    }
  }
};

validateEnvVariables();

// Basic service configuration
export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  serviceName: 'transaction-service'
} as const;

// PostgreSQL database configuration
export const dbConfig = {
  host: process.env.DB_HOST as string,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME as string,
  user: process.env.DB_USER as string,
  password: process.env.DB_PASSWORD as string,
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: 30000, // 30 seconds
    connectionTimeoutMillis: 2000 // 2 seconds
  }
} as const;

// Logging configuration
export const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'json',
  filename: 'transaction-service.log',
  maxSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5
} as const;

// Transaction categorization configuration
export const categorizationConfig = {
  confidenceThreshold: 0.9, // 90% confidence required for auto-categorization
  maxRetries: 3, // Maximum retries for categorization
  retryDelayMs: 1000, // 1 second delay between retries
  batchSize: 100, // Number of transactions to process in a batch
  cacheDuration: 3600 // 1 hour cache duration for categorization rules
} as const;

// API rate limiting configuration based on technical specifications
export const rateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  burstLimit: 20 // Allow burst of 20 additional requests
} as const;

// Error codes for transaction service
export const errorCodes = {
  TRANSACTION_ERROR_RANGE: ERROR_CODES.TRANSACTION_ERROR_RANGE
} as const;

// Performance optimization configuration
export const performanceConfig = {
  responseTimeLimit: 1000, // 1 second maximum response time
  queryTimeout: 5000, // 5 seconds query timeout
  cacheEnabled: true,
  cacheTTL: 300, // 5 minutes cache TTL
  compressionThreshold: 1024 // Compress responses larger than 1KB
} as const;

// Data retention configuration
export const dataRetentionConfig = {
  transactionHistoryMonths: 84, // 7 years
  archivalBatchSize: 1000,
  archivalInterval: 24 * 60 * 60 * 1000, // 24 hours
  cleanupBatchSize: 500
} as const;

// Monitoring configuration
export const monitoringConfig = {
  metricsEnabled: true,
  metricsInterval: 60, // 60 seconds
  healthCheckPath: '/health',
  healthCheckInterval: 30000, // 30 seconds
  alertThresholds: {
    errorRate: 0.05, // 5% error rate threshold
    responseTime: 1000, // 1 second response time threshold
    cpuUsage: 0.8 // 80% CPU usage threshold
  }
} as const;