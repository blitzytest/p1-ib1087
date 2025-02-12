// @package dotenv v16.0.3
import { config } from 'dotenv';
import { ERROR_CODES } from '../../shared/constants';
import { Logger } from '../../shared/utils/logger';

// Initialize environment variables
config();

// Initialize logger for configuration issues
const logger = new Logger('budget-service-config');

// Service base configuration
export const config = {
  env: process.env.NODE_ENV || 'development',
  serviceName: 'budget-service',
  port: Number(process.env.BUDGET_SERVICE_PORT) || 3000,
  version: '1.0.0'
} as const;

// Enhanced database configuration with security and performance settings
export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'mint_clone',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: process.env.NODE_ENV === 'production',
    ca: process.env.DB_SSL_CA,
    cert: process.env.DB_SSL_CERT,
    key: process.env.DB_SSL_KEY
  },
  pool: {
    min: Number(process.env.DB_POOL_MIN) || 2,
    max: Number(process.env.DB_POOL_MAX) || 10,
    idleTimeoutMillis: 30000
  },
  queryTimeout: 10000 // 10 seconds
} as const;

// Comprehensive budget processing and retention configuration
export const budgetConfig = {
  defaultCurrency: 'USD',
  alertThresholds: {
    warning: 0.75, // 75% of budget
    critical: 0.90, // 90% of budget
    overBudget: 1.0 // 100% of budget
  },
  updateInterval: Number(process.env.BUDGET_UPDATE_INTERVAL) || 3600000, // 1 hour
  maxTransactionAge: 90, // days
  retentionPeriod: {
    active: 365, // 1 year
    archived: 2555, // 7 years
    auditLogs: 90 // 3 months
  },
  batchSize: Number(process.env.BUDGET_BATCH_SIZE) || 100
} as const;

// Enhanced service communication configuration with resilience patterns
export const serviceEndpoints = {
  transactionService: process.env.TRANSACTION_SERVICE_URL || 'http://transaction-service:3000',
  notificationService: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3000',
  healthCheck: {
    enabled: true,
    interval: 30000, // 30 seconds
    timeout: 5000 // 5 seconds
  },
  timeout: {
    default: 5000, // 5 seconds
    long: 30000 // 30 seconds
  },
  retry: {
    attempts: 3,
    backoff: {
      initial: 1000,
      multiplier: 2,
      maxDelay: 10000
    }
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 30000
  }
} as const;

// Cache configuration for performance optimization
export const cacheConfig = {
  enabled: process.env.ENABLE_CACHE === 'true',
  ttl: Number(process.env.CACHE_TTL) || 300, // 5 minutes
  maxSize: Number(process.env.CACHE_MAX_SIZE) || 1000 // items
} as const;

// Enhanced logging configuration with rotation policies
export const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  filename: `logs/budget-service-%DATE%.log`,
  rotation: {
    maxFiles: '30d', // Keep logs for 30 days
    maxSize: '100m', // 100 MB
    compress: true
  }
} as const;

/**
 * Validates all required configuration values are present and within acceptable ranges
 * @throws {Error} If configuration is invalid
 * @returns {boolean} True if configuration is valid
 */
function validateConfig(): boolean {
  try {
    // Validate database configuration
    if (!dbConfig.user || !dbConfig.password) {
      throw new Error('Database credentials are required');
    }

    // Validate port number
    if (config.port <= 0 || config.port > 65535) {
      throw new Error('Invalid port number');
    }

    // Validate service endpoints
    if (!serviceEndpoints.transactionService || !serviceEndpoints.notificationService) {
      throw new Error('Service endpoints are required');
    }

    // Validate budget thresholds
    const { warning, critical, overBudget } = budgetConfig.alertThresholds;
    if (warning >= critical || critical >= overBudget) {
      throw new Error('Invalid budget threshold configuration');
    }

    // Validate retention periods
    if (budgetConfig.retentionPeriod.active > budgetConfig.retentionPeriod.archived) {
      throw new Error('Active retention period cannot exceed archive period');
    }

    // Validate cache configuration
    if (cacheConfig.enabled && (!cacheConfig.ttl || !cacheConfig.maxSize)) {
      throw new Error('Invalid cache configuration');
    }

    // Log successful validation
    logger.info('Configuration validated successfully', {
      service: config.serviceName,
      environment: config.env
    });

    return true;
  } catch (error) {
    logger.error('Configuration validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: ERROR_CODES.BUDGET_ERROR_RANGE.MIN,
      service: config.serviceName
    });
    throw error;
  }
}

// Validate configuration on module load
validateConfig();