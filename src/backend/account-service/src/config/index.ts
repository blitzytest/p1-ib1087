// @package dotenv v16.0.3
import { config as dotenvConfig } from 'dotenv';
import { AUTH_CONSTANTS, PLAID_CONFIG, API_RATE_LIMITS } from '../../../shared/constants';
import { Logger } from '../../../shared/utils/logger';

// Initialize environment variables
dotenvConfig();

// Initialize logger for configuration validation
const logger = new Logger('account-service-config');

// Configuration interface definitions
interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  poolSize: number;
  connectionTimeout: number;
  idleTimeout: number;
}

interface PlaidConfig {
  clientId: string;
  secret: string;
  environment: string;
  connectTimeout: number;
  syncInterval: number;
  webhookUrl: string;
}

interface LoggingConfig {
  level: string;
  path: string;
  maxFiles: number;
  maxSize: string;
}

interface CorsConfig {
  origin: string[];
  methods: string[];
  allowedHeaders: string[];
  maxAge: number;
}

interface PerformanceConfig {
  timeout: number;
  maxConnections: number;
  connectionIdleTimeout: number;
  maxAccountsPerUser: number;
}

interface SecurityConfig {
  rateLimiting: boolean;
  maxRequestSize: string;
  trustProxy: boolean;
  helmet: boolean;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

// Configuration validation function
export function validateConfig(): void {
  try {
    // Validate required environment variables
    const requiredEnvVars = [
      'NODE_ENV',
      'SERVICE_PORT',
      'SERVICE_HOST',
      'DB_HOST',
      'DB_PORT',
      'DB_NAME',
      'DB_USER',
      'DB_PASSWORD'
    ];

    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    });

    // Validate port number
    const port = Number(process.env.SERVICE_PORT);
    if (isNaN(port) || port <= 0 || port > 65535) {
      throw new Error('Invalid SERVICE_PORT value');
    }

    // Validate database configuration
    const dbPort = Number(process.env.DB_PORT);
    if (isNaN(dbPort) || dbPort <= 0 || dbPort > 65535) {
      throw new Error('Invalid DB_PORT value');
    }

    // Validate Plaid configuration
    if (!PLAID_CONFIG.CLIENT_ID || !PLAID_CONFIG.SECRET || !PLAID_CONFIG.ENV) {
      throw new Error('Invalid Plaid configuration');
    }

    logger.info('Configuration validation successful');
  } catch (error) {
    logger.error('Configuration validation failed', { error });
    throw error;
  }
}

// Export configuration object
export const config = {
  env: process.env.NODE_ENV || 'development',
  serviceName: 'account-service',
  port: Number(process.env.SERVICE_PORT) || 3000,
  host: process.env.SERVICE_HOST || 'localhost',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'mintclone',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    poolSize: Number(process.env.DB_POOL_SIZE) || 10,
    connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT) || 10000,
    idleTimeout: Number(process.env.DB_IDLE_TIMEOUT) || 30000
  } as DatabaseConfig,

  plaid: {
    clientId: PLAID_CONFIG.CLIENT_ID,
    secret: PLAID_CONFIG.SECRET,
    environment: PLAID_CONFIG.ENV,
    connectTimeout: Number(process.env.PLAID_CONNECT_TIMEOUT) || 30000,
    syncInterval: Number(process.env.PLAID_SYNC_INTERVAL) || 3600000,
    webhookUrl: process.env.PLAID_WEBHOOK_URL || ''
  } as PlaidConfig,

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    path: process.env.LOG_PATH || 'logs',
    maxFiles: Number(process.env.LOG_MAX_FILES) || 30,
    maxSize: process.env.LOG_MAX_SIZE || '20m'
  } as LoggingConfig,

  cors: {
    origin: (process.env.CORS_ORIGIN || '*').split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400
  } as CorsConfig,

  performance: {
    timeout: Number(process.env.REQUEST_TIMEOUT) || 30000,
    maxConnections: Number(process.env.MAX_CONNECTIONS) || 1000,
    connectionIdleTimeout: Number(process.env.CONNECTION_IDLE_TIMEOUT) || 60000,
    maxAccountsPerUser: Number(process.env.MAX_ACCOUNTS_PER_USER) || 100
  } as PerformanceConfig,

  security: {
    rateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
    trustProxy: process.env.TRUST_PROXY === 'true',
    helmet: process.env.ENABLE_HELMET !== 'false'
  } as SecurityConfig,

  rateLimits: {
    windowMs: API_RATE_LIMITS.ACCOUNTS.WINDOW_MINUTES * 60 * 1000,
    max: API_RATE_LIMITS.ACCOUNTS.LIMIT,
    standardHeaders: true,
    legacyHeaders: false
  } as RateLimitConfig,

  auth: {
    jwtSecret: AUTH_CONSTANTS.JWT_SECRET,
    jwtExpiry: AUTH_CONSTANTS.JWT_EXPIRY
  }
} as const;

// Validate configuration on module load
validateConfig();