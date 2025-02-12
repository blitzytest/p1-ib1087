// @package dotenv v16.0.3
// @package joi v17.9.2
import { config as dotenvConfig } from 'dotenv';
import joi from 'joi';
import { AUTH_CONSTANTS } from '../../shared/constants';
import { Logger } from '../../shared/utils/logger';

// Initialize environment variables
dotenvConfig();

// Initialize logger for configuration
const logger = new Logger('auth-config', {
  maskFields: ['jwtSecret', 'dbUri', 'redisUri']
});

// Configuration validation schema
const configSchema = joi.object({
  NODE_ENV: joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  
  PORT: joi.number()
    .port()
    .default(3000),

  JWT_SECRET: joi.string()
    .required()
    .min(32)
    .messages({
      'string.min': 'JWT_SECRET must be at least 32 characters long for security'
    }),

  JWT_EXPIRY: joi.number()
    .default(AUTH_CONSTANTS.JWT_EXPIRY)
    .min(300) // Minimum 5 minutes
    .max(86400), // Maximum 24 hours

  REFRESH_TOKEN_EXPIRY: joi.number()
    .default(AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY)
    .min(3600) // Minimum 1 hour
    .max(2592000), // Maximum 30 days

  MFA_ENABLED: joi.boolean()
    .default(true),

  MFA_CODE_LENGTH: joi.number()
    .default(AUTH_CONSTANTS.MFA_CODE_LENGTH)
    .valid(6, 8),

  MFA_CODE_EXPIRY: joi.number()
    .default(AUTH_CONSTANTS.MFA_CODE_EXPIRY)
    .min(300) // Minimum 5 minutes
    .max(900), // Maximum 15 minutes

  DB_URI: joi.string()
    .required()
    .uri()
    .messages({
      'string.uri': 'DB_URI must be a valid MongoDB connection string'
    }),

  REDIS_URI: joi.string()
    .required()
    .uri()
    .messages({
      'string.uri': 'REDIS_URI must be a valid Redis connection string'
    }),

  RATE_LIMIT_WINDOW: joi.number()
    .default(60) // 1 minute in seconds
    .min(30)
    .max(3600),

  RATE_LIMIT_MAX_REQUESTS: joi.number()
    .default(5)
    .min(1)
    .max(100)
});

/**
 * Validates environment variables against the defined schema
 * @param envVars Object containing environment variables
 * @returns Validated and typed configuration object
 */
const validateConfig = (envVars: NodeJS.ProcessEnv) => {
  try {
    const { value: validatedEnvVars, error } = configSchema.validate(envVars, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      logger.error('Configuration validation failed', { 
        error: errorMessage,
        env: validatedEnvVars.NODE_ENV 
      });
      
      throw new Error(`Configuration validation error: ${errorMessage}`);
    }

    // Additional production environment validations
    if (validatedEnvVars.NODE_ENV === 'production') {
      if (validatedEnvVars.JWT_SECRET.length < 64) {
        throw new Error('Production JWT_SECRET must be at least 64 characters');
      }
      
      if (!validatedEnvVars.MFA_ENABLED) {
        logger.warn('MFA is disabled in production environment');
      }
    }

    logger.info('Configuration validated successfully', {
      env: validatedEnvVars.NODE_ENV
    });

    return validatedEnvVars;
  } catch (error) {
    logger.error('Configuration validation error', { error });
    throw error;
  }
};

// Validate and export configuration
const validatedConfig = validateConfig(process.env);

export const config = {
  env: validatedConfig.NODE_ENV as 'development' | 'production' | 'test',
  port: validatedConfig.PORT as number,
  jwtSecret: validatedConfig.JWT_SECRET as string,
  jwtExpiry: validatedConfig.JWT_EXPIRY as number,
  refreshTokenExpiry: validatedConfig.REFRESH_TOKEN_EXPIRY as number,
  mfaEnabled: validatedConfig.MFA_ENABLED as boolean,
  mfaCodeLength: validatedConfig.MFA_CODE_LENGTH as number,
  mfaCodeExpiry: validatedConfig.MFA_CODE_EXPIRY as number,
  dbUri: validatedConfig.DB_URI as string,
  redisUri: validatedConfig.REDIS_URI as string,
  rateLimitWindow: validatedConfig.RATE_LIMIT_WINDOW as number,
  rateLimitMaxRequests: validatedConfig.RATE_LIMIT_MAX_REQUESTS as number
} as const;

// Export individual config values for convenience
export const {
  env,
  port,
  jwtSecret,
  jwtExpiry,
  refreshTokenExpiry,
  mfaEnabled,
  mfaCodeLength,
  mfaCodeExpiry,
  dbUri,
  redisUri,
  rateLimitWindow,
  rateLimitMaxRequests
} = config;