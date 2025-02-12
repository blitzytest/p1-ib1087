/**
 * Authentication API service module for Mint Clone application
 * Implements secure user authentication, MFA, and session management
 * @version 1.0.0
 */

import api, { API_ENDPOINTS } from '../../config/api';
import { AxiosError } from 'axios'; // ^1.4.0
import rateLimit from 'axios-rate-limit'; // ^1.3.0
import validator from 'validator'; // ^13.9.0
import { SecurityLogger } from '@logging/security'; // ^2.0.0
import {
  ApiResponse,
  LoginRequest,
  AuthResponse,
  ErrorResponse
} from '../../types/api';
import { VALIDATION_RULES, ERROR_CODES, RATE_LIMITS } from '../../config/constants';

// Configure rate limiting for auth endpoints
const rateLimitedApi = rateLimit(api, {
  maxRequests: RATE_LIMITS.AUTH.requests,
  perMilliseconds: 60000,
  maxRPS: RATE_LIMITS.AUTH.burst
});

// Security logger instance
const securityLogger = new SecurityLogger({
  service: 'auth-service',
  retention: '1y'
});

/**
 * Authentication service with enhanced security features
 */
export const authService = {
  /**
   * Authenticates user with email/password and handles MFA
   * @param credentials - User login credentials
   * @param deviceInfo - Device fingerprint information
   * @returns Authentication response with tokens
   */
  async login(
    credentials: LoginRequest,
    deviceInfo: { deviceId: string; fingerprint: string }
  ): Promise<ApiResponse<AuthResponse>> {
    try {
      // Validate input
      if (!validator.isEmail(credentials.email)) {
        throw new Error('Invalid email format');
      }
      if (!VALIDATION_RULES.PASSWORD_PATTERN.test(credentials.password)) {
        throw new Error('Invalid password format');
      }

      // Sanitize inputs
      const sanitizedEmail = validator.normalizeEmail(credentials.email);
      if (!sanitizedEmail) {
        throw new Error('Email sanitization failed');
      }

      const response = await rateLimitedApi.post<ApiResponse<AuthResponse>>(
        API_ENDPOINTS.AUTH.LOGIN,
        {
          email: sanitizedEmail,
          password: credentials.password,
          deviceId: deviceInfo.deviceId,
          fingerprint: deviceInfo.fingerprint
        }
      );

      // Log successful authentication
      securityLogger.info('User login successful', {
        userId: response.data.data.accessToken,
        deviceId: deviceInfo.deviceId,
        mfaRequired: response.data.data.mfaRequired
      });

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      
      // Log failed authentication attempt
      securityLogger.warn('Authentication failed', {
        email: credentials.email,
        deviceId: deviceInfo.deviceId,
        errorCode: axiosError.response?.data?.code
      });

      throw {
        code: axiosError.response?.data?.code || ERROR_CODES.AUTH.INVALID_CREDENTIALS,
        message: axiosError.response?.data?.message || 'Authentication failed',
        details: axiosError.response?.data?.details || {}
      };
    }
  },

  /**
   * Verifies MFA code for enhanced authentication
   * @param params - MFA verification parameters
   * @returns Authentication response with new tokens
   */
  async verifyMfa(params: {
    mfaToken: string;
    code: string;
    method: 'sms' | 'authenticator' | 'backup';
  }): Promise<ApiResponse<AuthResponse>> {
    try {
      // Validate MFA code format
      if (!validator.isLength(params.code, { min: 6, max: 6 })) {
        throw new Error('Invalid MFA code format');
      }

      const response = await rateLimitedApi.post<ApiResponse<AuthResponse>>(
        API_ENDPOINTS.AUTH.MFA_VERIFY,
        params
      );

      // Log successful MFA verification
      securityLogger.info('MFA verification successful', {
        mfaToken: params.mfaToken,
        method: params.method
      });

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      
      // Log failed MFA attempt
      securityLogger.warn('MFA verification failed', {
        mfaToken: params.mfaToken,
        method: params.method,
        errorCode: axiosError.response?.data?.code
      });

      throw {
        code: axiosError.response?.data?.code || ERROR_CODES.AUTH.MFA_REQUIRED,
        message: axiosError.response?.data?.message || 'MFA verification failed',
        details: axiosError.response?.data?.details || {}
      };
    }
  },

  /**
   * Initiates password reset process
   * @param email - User's email address
   * @returns API response with reset token
   */
  async forgotPassword(email: string): Promise<ApiResponse<{ resetToken: string }>> {
    try {
      if (!validator.isEmail(email)) {
        throw new Error('Invalid email format');
      }

      const sanitizedEmail = validator.normalizeEmail(email);
      if (!sanitizedEmail) {
        throw new Error('Email sanitization failed');
      }

      const response = await rateLimitedApi.post<ApiResponse<{ resetToken: string }>>(
        API_ENDPOINTS.AUTH.FORGOT_PASSWORD,
        { email: sanitizedEmail }
      );

      // Log password reset request
      securityLogger.info('Password reset requested', { email: sanitizedEmail });

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      throw {
        code: axiosError.response?.data?.code || 'PASSWORD_RESET_ERROR',
        message: axiosError.response?.data?.message || 'Password reset failed',
        details: axiosError.response?.data?.details || {}
      };
    }
  },

  /**
   * Resets user password with token
   * @param params - Password reset parameters
   * @returns API response
   */
  async resetPassword(params: {
    resetToken: string;
    newPassword: string;
  }): Promise<ApiResponse<void>> {
    try {
      if (!VALIDATION_RULES.PASSWORD_PATTERN.test(params.newPassword)) {
        throw new Error('Invalid password format');
      }

      const response = await rateLimitedApi.post<ApiResponse<void>>(
        API_ENDPOINTS.AUTH.RESET_PASSWORD,
        params
      );

      // Log successful password reset
      securityLogger.info('Password reset successful', {
        resetToken: params.resetToken
      });

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      throw {
        code: axiosError.response?.data?.code || 'PASSWORD_RESET_ERROR',
        message: axiosError.response?.data?.message || 'Password reset failed',
        details: axiosError.response?.data?.details || {}
      };
    }
  },

  /**
   * Refreshes authentication tokens
   * @param refreshToken - Current refresh token
   * @returns New authentication tokens
   */
  async refreshToken(refreshToken: string): Promise<ApiResponse<AuthResponse>> {
    try {
      const response = await rateLimitedApi.post<ApiResponse<AuthResponse>>(
        API_ENDPOINTS.AUTH.REFRESH,
        { refreshToken }
      );

      // Log token refresh
      securityLogger.debug('Token refresh successful');

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      throw {
        code: axiosError.response?.data?.code || ERROR_CODES.AUTH.SESSION_EXPIRED,
        message: axiosError.response?.data?.message || 'Token refresh failed',
        details: axiosError.response?.data?.details || {}
      };
    }
  }
};

export default authService;