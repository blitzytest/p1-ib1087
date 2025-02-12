import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import axe from '@axe-core/react';
import { mockApi } from '../mocks/api';
import { LoginScreen } from '../../src/screens/auth/LoginScreen';
import { createStore } from '../../store';
import { VALIDATION_RULES, ERROR_CODES } from '../../config/constants';
import { Theme } from '../../types/theme';

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
};

// Mock biometrics
const mockBiometrics = {
  isAvailable: jest.fn(),
  authenticate: jest.fn(),
};

// Test setup helper
const setupTest = async (options = {}) => {
  const store = createStore();
  const renderResult = render(
    <Provider store={store}>
      <LoginScreen 
        navigation={mockNavigation} 
        testID="login-screen"
        {...options}
      />
    </Provider>
  );

  // Wait for initial animations and setup
  await waitFor(() => {
    expect(renderResult.getByTestId('login-screen')).toBeTruthy();
  });

  return {
    ...renderResult,
    store,
    mockNavigation,
  };
};

describe('LoginScreen E2E Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.clearMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Authentication Flows', () => {
    it('should successfully login with valid email/password', async () => {
      const { getByTestId, store } = await setupTest();

      // Enter credentials
      fireEvent.changeText(getByTestId('auth-email-input'), 'test@example.com');
      fireEvent.changeText(getByTestId('auth-password-input'), 'ValidPass123!');

      // Submit form
      fireEvent.press(getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(mockNavigation.replace).toHaveBeenCalledWith('Main');
        expect(store.getState().auth.isAuthenticated).toBe(true);
      });
    });

    it('should handle MFA flow correctly', async () => {
      mockApi.getMockResponse('login').mockImplementationOnce(() => ({
        success: true,
        data: {
          mfaRequired: true,
          mfaToken: 'mock-mfa-token'
        }
      }));

      const { getByTestId, store } = await setupTest();

      // Login with credentials
      fireEvent.changeText(getByTestId('auth-email-input'), 'test@example.com');
      fireEvent.changeText(getByTestId('auth-password-input'), 'ValidPass123!');
      fireEvent.press(getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(store.getState().auth.mfaRequired).toBe(true);
        expect(store.getState().auth.mfaToken).toBe('mock-mfa-token');
      });
    });

    it('should handle biometric authentication', async () => {
      mockBiometrics.isAvailable.mockResolvedValue({ available: true });
      mockBiometrics.authenticate.mockResolvedValue(true);

      const { getByTestId } = await setupTest();

      fireEvent.press(getByTestId('auth-biometric-button'));

      await waitFor(() => {
        expect(mockNavigation.replace).toHaveBeenCalledWith('Main');
      });
    });
  });

  describe('Error Handling', () => {
    it('should display validation errors for invalid input', async () => {
      const { getByTestId, queryByText } = await setupTest();

      // Submit with empty fields
      fireEvent.press(getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(queryByText('Email is required')).toBeTruthy();
        expect(queryByText('Password is required')).toBeTruthy();
      });
    });

    it('should handle invalid credentials error', async () => {
      mockApi.getMockResponse('login').mockRejectedValueOnce({
        code: ERROR_CODES.AUTH.INVALID_CREDENTIALS,
        message: 'Invalid email or password'
      });

      const { getByTestId, queryByText } = await setupTest();

      // Enter invalid credentials
      fireEvent.changeText(getByTestId('auth-email-input'), 'test@example.com');
      fireEvent.changeText(getByTestId('auth-password-input'), 'WrongPass123!');
      fireEvent.press(getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(queryByText('Invalid email or password')).toBeTruthy();
      });
    });

    it('should handle network errors', async () => {
      mockApi.simulateNetworkError();

      const { getByTestId, queryByText } = await setupTest();

      // Attempt login
      fireEvent.changeText(getByTestId('auth-email-input'), 'test@example.com');
      fireEvent.changeText(getByTestId('auth-password-input'), 'ValidPass123!');
      fireEvent.press(getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(queryByText('Network error occurred')).toBeTruthy();
      });
    });

    it('should handle rate limiting', async () => {
      mockApi.simulateRateLimit();

      const { getByTestId, queryByText } = await setupTest();

      // Attempt login multiple times
      for (let i = 0; i < 6; i++) {
        fireEvent.press(getByTestId('auth-submit-button'));
      }

      await waitFor(() => {
        expect(queryByText('Too many attempts')).toBeTruthy();
      });
    });
  });

  describe('Performance Validation', () => {
    it('should render login screen within performance budget', async () => {
      const startTime = performance.now();
      
      await setupTest();
      
      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(100); // 100ms budget
    });

    it('should process login request within SLA', async () => {
      const { getByTestId } = await setupTest();

      const startTime = performance.now();

      // Perform login
      fireEvent.changeText(getByTestId('auth-email-input'), 'test@example.com');
      fireEvent.changeText(getByTestId('auth-password-input'), 'ValidPass123!');
      fireEvent.press(getByTestId('auth-submit-button'));

      await waitFor(() => {
        const requestTime = performance.now() - startTime;
        expect(requestTime).toBeLessThan(3000); // 3s SLA
      });
    });
  });

  describe('Security Validation', () => {
    it('should enforce password complexity requirements', async () => {
      const { getByTestId, queryByText } = await setupTest();

      // Test weak password
      fireEvent.changeText(getByTestId('auth-password-input'), 'weak');
      fireEvent.press(getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(queryByText(/Password must contain/)).toBeTruthy();
      });
    });

    it('should sanitize user input', async () => {
      const { getByTestId } = await setupTest();

      // Attempt XSS injection
      const maliciousInput = '<script>alert("xss")</script>';
      fireEvent.changeText(getByTestId('auth-email-input'), maliciousInput);

      const emailInput = getByTestId('auth-email-input');
      expect(emailInput.props.value).not.toContain('<script>');
    });

    it('should implement rate limiting for failed attempts', async () => {
      const { getByTestId, store } = await setupTest();

      // Simulate multiple failed attempts
      for (let i = 0; i < 5; i++) {
        fireEvent.press(getByTestId('auth-submit-button'));
        await waitFor(() => {
          expect(store.getState().auth.securityMetrics.failedAttempts).toBe(i + 1);
        });
      }

      // Verify lockout
      expect(getByTestId('auth-submit-button').props.disabled).toBe(true);
    });
  });

  describe('Accessibility Compliance', () => {
    it('should meet WCAG accessibility standards', async () => {
      const { container } = await setupTest();
      const results = await axe(container);
      expect(results.violations).toHaveLength(0);
    });

    it('should support screen readers', async () => {
      const { getByTestId } = await setupTest();

      const loginScreen = getByTestId('login-screen');
      expect(loginScreen.props.accessibilityRole).toBe('none');

      const emailInput = getByTestId('auth-email-input');
      expect(emailInput.props.accessibilityLabel).toBeTruthy();
      expect(emailInput.props.accessibilityRole).toBe('textbox');
    });

    it('should handle keyboard navigation', async () => {
      const { getByTestId } = await setupTest();

      const emailInput = getByTestId('auth-email-input');
      const passwordInput = getByTestId('auth-password-input');
      const submitButton = getByTestId('auth-submit-button');

      // Verify tab order
      expect(document.body).toHaveFocus();
      fireEvent.keyDown(document.body, { key: 'Tab' });
      expect(emailInput).toHaveFocus();
      fireEvent.keyDown(emailInput, { key: 'Tab' });
      expect(passwordInput).toHaveFocus();
      fireEvent.keyDown(passwordInput, { key: 'Tab' });
      expect(submitButton).toHaveFocus();
    });

    it('should announce form errors to screen readers', async () => {
      const { getByTestId } = await setupTest();

      // Submit with errors
      fireEvent.press(getByTestId('auth-submit-button'));

      await waitFor(() => {
        const errorMessages = document.querySelectorAll('[role="alert"]');
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });
});