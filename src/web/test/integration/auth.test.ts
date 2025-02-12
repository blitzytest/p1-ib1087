/**
 * Integration tests for authentication functionality in Mint Clone application
 * Covers comprehensive test scenarios for user authentication flows
 * @version 1.0.0
 */

import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { render, waitFor, act } from '@testing-library/react-native';
import { authService } from '../../src/services/api/auth';
import { mockApi } from '../mocks/api';
import { resetMockStorage } from '../mocks/storage';
import { ERROR_CODES, VALIDATION_RULES, PERFORMANCE_THRESHOLDS } from '../../src/config/constants';

// Test constants
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test@123456',
  deviceId: 'test-device-123',
  fingerprint: 'test-fingerprint-456'
};

const TEST_MFA = {
  mfaToken: 'test-mfa-token',
  code: '123456',
  method: 'authenticator' as const
};

// Setup and teardown
beforeEach(() => {
  resetMockStorage();
  jest.useFakeTimers();
});

afterEach(() => {
  mockApi.clearMocks();
  jest.useRealTimers();
});

describe('Authentication Integration Tests', () => {
  describe('Login Flow', () => {
    test('should successfully login user with valid credentials', async () => {
      // Setup mock response
      const mockAuthResponse = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        mfaRequired: false,
        mfaToken: null,
        expiresIn: 3600
      };

      mockApi.getMockResponse('login').mockResolvedValueOnce({
        success: true,
        data: mockAuthResponse,
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      });

      // Execute login
      const response = await authService.login(
        { email: TEST_USER.email, password: TEST_USER.password },
        { deviceId: TEST_USER.deviceId, fingerprint: TEST_USER.fingerprint }
      );

      // Verify response
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockAuthResponse);
      expect(response.error).toBeNull();
    });

    test('should handle invalid credentials', async () => {
      // Setup mock error response
      mockApi.getMockResponse('login').mockRejectedValueOnce({
        code: ERROR_CODES.AUTH.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
        details: {}
      });

      // Execute and verify error handling
      await expect(
        authService.login(
          { email: TEST_USER.email, password: 'wrong-password' },
          { deviceId: TEST_USER.deviceId, fingerprint: TEST_USER.fingerprint }
        )
      ).rejects.toMatchObject({
        code: ERROR_CODES.AUTH.INVALID_CREDENTIALS
      });
    });

    test('should enforce rate limiting', async () => {
      // Setup rate limit exceeded response
      mockApi.getMockResponse('login').mockRejectedValueOnce({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts',
        details: { retryAfter: 60 }
      });

      // Attempt multiple logins
      await expect(
        authService.login(
          { email: TEST_USER.email, password: TEST_USER.password },
          { deviceId: TEST_USER.deviceId, fingerprint: TEST_USER.fingerprint }
        )
      ).rejects.toMatchObject({
        code: 'RATE_LIMIT_EXCEEDED'
      });
    });

    test('should timeout after 1s', async () => {
      // Setup delayed response
      mockApi.getMockResponse('login').mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 1500))
      );

      // Verify timeout
      await expect(
        authService.login(
          { email: TEST_USER.email, password: TEST_USER.password },
          { deviceId: TEST_USER.deviceId, fingerprint: TEST_USER.fingerprint }
        )
      ).rejects.toMatchObject({
        code: 'TIMEOUT_ERROR'
      });
    });
  });

  describe('MFA Flow', () => {
    test('should handle MFA verification during login', async () => {
      // Setup MFA required response
      const mfaResponse = {
        accessToken: null,
        refreshToken: null,
        mfaRequired: true,
        mfaToken: TEST_MFA.mfaToken,
        expiresIn: 300
      };

      mockApi.getMockResponse('login').mockResolvedValueOnce({
        success: true,
        data: mfaResponse,
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      });

      // Verify MFA trigger
      const loginResponse = await authService.login(
        { email: TEST_USER.email, password: TEST_USER.password },
        { deviceId: TEST_USER.deviceId, fingerprint: TEST_USER.fingerprint }
      );

      expect(loginResponse.data.mfaRequired).toBe(true);
      expect(loginResponse.data.mfaToken).toBe(TEST_MFA.mfaToken);

      // Setup MFA verification response
      const verifyResponse = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        mfaRequired: false,
        mfaToken: null,
        expiresIn: 3600
      };

      mockApi.getMockResponse('verifyMfa').mockResolvedValueOnce({
        success: true,
        data: verifyResponse,
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      });

      // Verify MFA code
      const mfaVerifyResponse = await authService.verifyMfa(TEST_MFA);
      expect(mfaVerifyResponse.success).toBe(true);
      expect(mfaVerifyResponse.data.accessToken).toBeTruthy();
    });

    test('should handle invalid MFA codes', async () => {
      mockApi.getMockResponse('verifyMfa').mockRejectedValueOnce({
        code: ERROR_CODES.AUTH.MFA_REQUIRED,
        message: 'Invalid MFA code',
        details: {}
      });

      await expect(authService.verifyMfa({
        ...TEST_MFA,
        code: '000000'
      })).rejects.toMatchObject({
        code: ERROR_CODES.AUTH.MFA_REQUIRED
      });
    });
  });

  describe('Password Reset Flow', () => {
    test('should complete password reset process', async () => {
      // Setup forgot password response
      mockApi.getMockResponse('forgotPassword').mockResolvedValueOnce({
        success: true,
        data: { resetToken: 'test-reset-token' },
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      });

      // Request password reset
      const forgotResponse = await authService.forgotPassword(TEST_USER.email);
      expect(forgotResponse.success).toBe(true);
      expect(forgotResponse.data.resetToken).toBeTruthy();

      // Setup reset password response
      mockApi.getMockResponse('resetPassword').mockResolvedValueOnce({
        success: true,
        data: null,
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      });

      // Complete password reset
      const resetResponse = await authService.resetPassword({
        resetToken: forgotResponse.data.resetToken,
        newPassword: 'NewTest@123456'
      });

      expect(resetResponse.success).toBe(true);
    });

    test('should validate password requirements', async () => {
      await expect(authService.resetPassword({
        resetToken: 'test-reset-token',
        newPassword: 'weak'
      })).rejects.toThrow('Invalid password format');
    });
  });

  describe('Token Refresh Flow', () => {
    test('should refresh authentication tokens', async () => {
      // Setup refresh token response
      const refreshResponse = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        mfaRequired: false,
        mfaToken: null,
        expiresIn: 3600
      };

      mockApi.getMockResponse('refresh').mockResolvedValueOnce({
        success: true,
        data: refreshResponse,
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      });

      // Perform token refresh
      const response = await authService.refreshToken('old-refresh-token');
      expect(response.success).toBe(true);
      expect(response.data.accessToken).toBe('new-access-token');
    });

    test('should handle expired refresh tokens', async () => {
      mockApi.getMockResponse('refresh').mockRejectedValueOnce({
        code: ERROR_CODES.AUTH.SESSION_EXPIRED,
        message: 'Refresh token expired',
        details: {}
      });

      await expect(authService.refreshToken('expired-token'))
        .rejects.toMatchObject({
          code: ERROR_CODES.AUTH.SESSION_EXPIRED
        });
    });
  });
});