/**
 * Central configuration export file for Mint Clone mobile application
 * Aggregates and re-exports all configuration modules with enhanced performance,
 * security, and validation features
 * @version 2.0.0
 */

import api from './api';
import { theme } from './theme';
import * as navigationConfig from './navigation';
import { 
  API_CONSTANTS,
  VALIDATION_RULES,
  FEATURE_FLAGS,
  PLAID_CONFIG,
  ERROR_CODES,
  PERFORMANCE_THRESHOLDS,
  RATE_LIMITS,
  DATA_RETENTION
} from './constants';

// Version tracking for configuration system
export const CONFIG_VERSION = '2.0.0';

/**
 * Performance monitoring configuration with circuit breaker patterns
 */
export const PERFORMANCE_CONFIG = {
  API_TIMEOUT: PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME,
  CIRCUIT_BREAKER_THRESHOLD: 5,
  CACHE_TTL: PERFORMANCE_THRESHOLDS.CACHE_TTL,
  STALE_DATA_THRESHOLD: PERFORMANCE_THRESHOLDS.STALE_DATA_THRESHOLD,
  UPTIME_TARGET: PERFORMANCE_THRESHOLDS.UPTIME_TARGET
};

/**
 * Security configuration for authentication and data protection
 */
export const SECURITY_CONFIG = {
  AUTH: {
    SESSION_TIMEOUT: 3600, // 1 hour in seconds
    REFRESH_THRESHOLD: 300, // 5 minutes in seconds
    MFA_TIMEOUT: 300, // 5 minutes in seconds
    PASSWORD_RULES: VALIDATION_RULES.PASSWORD_PATTERN,
    MAX_LOGIN_ATTEMPTS: 5
  },
  API: {
    RATE_LIMITS,
    ERROR_CODES,
    RETRY_ATTEMPTS: API_CONSTANTS.RETRY_ATTEMPTS
  },
  DATA: {
    RETENTION: DATA_RETENTION,
    ENCRYPTION: true,
    SECURE_STORAGE: true
  }
};

/**
 * Feature configuration for gradual rollout and platform-specific features
 */
export const FEATURE_CONFIG = {
  ...FEATURE_FLAGS,
  PLAID: PLAID_CONFIG,
  PERFORMANCE_MONITORING: true,
  ERROR_TRACKING: true,
  ANALYTICS_ENABLED: FEATURE_FLAGS.ENABLE_ANALYTICS
};

/**
 * Enhanced configuration validation with performance and security checks
 * @throws Error if configuration is invalid
 */
const validateConfig = (): void => {
  // Validate API configuration
  if (!API_CONSTANTS.BASE_URL) {
    throw new Error('API base URL is required');
  }

  // Validate security settings
  if (!VALIDATION_RULES.PASSWORD_PATTERN || !VALIDATION_RULES.EMAIL_PATTERN) {
    throw new Error('Security validation rules are incomplete');
  }

  // Validate performance thresholds
  if (PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME <= 0) {
    throw new Error('Invalid API response time threshold');
  }

  // Validate feature flags
  if (typeof FEATURE_FLAGS.ENABLE_ANALYTICS !== 'boolean') {
    throw new Error('Invalid analytics feature flag configuration');
  }
};

// Validate configuration on import
validateConfig();

// Export enhanced API instance with performance monitoring
export { api };

// Export theme configuration with financial visualization support
export { theme };

// Export navigation configuration with security routes
export { navigationConfig };

// Export constants with type safety
export {
  API_CONSTANTS,
  VALIDATION_RULES,
  ERROR_CODES,
  PERFORMANCE_THRESHOLDS,
  RATE_LIMITS,
  DATA_RETENTION
};

// Export configuration types for type safety
export type { Theme } from '../types/theme';
export type {
  RootStackParamList,
  AuthStackParamList,
  MainTabParamList,
  AccountStackParamList,
  BudgetStackParamList,
  InvestmentStackParamList,
  ProfileStackParamList
} from '../types/navigation';