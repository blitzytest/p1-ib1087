import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { waitFor } from '@testing-library/react';
import { useAuth } from '../../../src/hooks/useAuth';
import { mockApi } from '../../mocks/api';
import { resetMockStorage } from '../../mocks/storage';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../../src/store/slices/authSlice';
import { mockBiometrics } from '@react-native-biometrics/core';

// Mock store setup
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer
    },
    preloadedState: initialState
  });
};

describe('useAuth Hook', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    // Reset all mocks and storage
    resetMockStorage();
    mockApi.clearMocks();
    store = createTestStore();
    jest.clearAllMocks();
  });

  describe('Login Flow', () => {
    it('should handle successful email/password login', async () => {
      // Mock successful login response
      const mockLoginResponse = {
        success: true,
        data: {
          accessToken: 'test-token',
          refreshToken: 'test-refresh',
          mfaRequired: false,
          expiresIn: 3600
        }
      };
      mockApi.getMockResponse('login').mockResolvedValueOnce(mockLoginResponse);

      // Render hook with store provider
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        )
      });

      // Execute login
      await act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'Test123!@#'
        });
      });

      // Verify authentication state
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.currentUser).toBeTruthy();
      expect(result.current.error).toBeNull();
    });

    it('should handle MFA challenge during login', async () => {
      // Mock MFA required response
      const mockMfaResponse = {
        success: true,
        data: {
          mfaRequired: true,
          mfaToken: 'mfa-token',
          accessToken: null
        }
      };
      mockApi.getMockResponse('login').mockResolvedValueOnce(mockMfaResponse);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        )
      });

      // Execute login
      await act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'Test123!@#'
        });
      });

      // Verify MFA state
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeNull();

      // Mock successful MFA verification
      const mockVerifyResponse = {
        success: true,
        data: {
          accessToken: 'test-token',
          refreshToken: 'test-refresh',
          mfaRequired: false,
          expiresIn: 3600
        }
      };
      mockApi.getMockResponse('verifyMfa').mockResolvedValueOnce(mockVerifyResponse);

      // Verify MFA code
      await act(async () => {
        await result.current.verifyMfa('mfa-token', '123456');
      });

      // Verify authenticated state
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.currentUser).toBeTruthy();
    });

    it('should handle biometric authentication', async () => {
      // Mock biometric availability
      mockBiometrics.isAvailable.mockResolvedValueOnce(true);
      mockBiometrics.getStoredCredentials.mockResolvedValueOnce({
        username: 'test@example.com',
        token: 'stored-token'
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        )
      });

      // Execute biometric login
      await act(async () => {
        await result.current.loginWithBiometrics();
      });

      // Verify authentication state
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.currentUser).toBeTruthy();
      expect(result.current.error).toBeNull();
    });
  });

  describe('Registration Flow', () => {
    it('should handle successful registration', async () => {
      // Mock successful registration
      const mockRegisterResponse = {
        success: true,
        data: {
          accessToken: 'test-token',
          refreshToken: 'test-refresh',
          mfaRequired: false,
          expiresIn: 3600
        }
      };
      mockApi.getMockResponse('register').mockResolvedValueOnce(mockRegisterResponse);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        )
      });

      // Execute registration
      await act(async () => {
        await result.current.register({
          email: 'test@example.com',
          password: 'Test123!@#',
          confirmPassword: 'Test123!@#'
        });
      });

      // Verify registration success
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.currentUser).toBeTruthy();
      expect(result.current.error).toBeNull();
    });
  });

  describe('Session Management', () => {
    it('should handle session timeout and token refresh', async () => {
      // Setup authenticated session
      const initialState = {
        auth: {
          accessToken: 'expired-token',
          refreshToken: 'refresh-token',
          user: { id: 'test-user' }
        }
      };
      store = createTestStore(initialState);

      // Mock refresh token response
      const mockRefreshResponse = {
        success: true,
        data: {
          accessToken: 'new-token',
          refreshToken: 'new-refresh',
          expiresIn: 3600
        }
      };
      mockApi.getMockResponse('refresh').mockResolvedValueOnce(mockRefreshResponse);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        )
      });

      // Trigger token refresh
      await act(async () => {
        await result.current.refreshToken();
      });

      // Verify session refresh
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should handle logout', async () => {
      // Setup authenticated session
      const initialState = {
        auth: {
          accessToken: 'test-token',
          user: { id: 'test-user' }
        }
      };
      store = createTestStore(initialState);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        )
      });

      // Execute logout
      await act(async () => {
        await result.current.logout();
      });

      // Verify logged out state
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.currentUser).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid credentials', async () => {
      // Mock login failure
      const mockErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      };
      mockApi.getMockResponse('login').mockRejectedValueOnce(mockErrorResponse);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        )
      });

      // Attempt login
      await act(async () => {
        try {
          await result.current.login({
            email: 'test@example.com',
            password: 'wrong'
          });
        } catch (error) {
          // Error expected
        }
      });

      // Verify error state
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeTruthy();
      expect(result.current.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should handle network errors', async () => {
      // Mock network failure
      mockApi.getMockResponse('login').mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        )
      });

      // Attempt login
      await act(async () => {
        try {
          await result.current.login({
            email: 'test@example.com',
            password: 'Test123!@#'
          });
        } catch (error) {
          // Error expected
        }
      });

      // Verify error state
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeTruthy();
    });
  });
});