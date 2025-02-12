import React from 'react';
import { render, fireEvent, waitFor, act, within } from '@testing-library/react-native';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { axe, toHaveNoViolations } from '@axe-core/react';
import { AuthForm } from '../../src/components/auth/AuthForm';
import { BiometricPrompt } from '../../src/components/auth/BiometricPrompt';
import { useAuth } from '../../src/hooks/useAuth';
import { VALIDATION_RULES } from '../../src/config/constants';

// Add accessibility matchers
expect.extend(toHaveNoViolations);

// Mock hooks and services
jest.mock('../../src/hooks/useAuth');
jest.mock('../../src/services/biometrics');
jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        brand: { primary: '#00A6A4' },
        text: { primary: '#0B3954', inverse: '#FFFFFF' },
        status: { error: '#F44336' },
        background: { primary: '#FFFFFF' }
      },
      spacing: { sm: 8, md: 16 }
    }
  })
}));

describe('AuthForm Component', () => {
  const mockOnSuccess = jest.fn();
  const mockOnError = jest.fn();
  const mockLogin = jest.fn();
  const mockRegister = jest.fn();
  const mockVerifyMfa = jest.fn();

  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      register: mockRegister,
      verifyMfa: mockVerifyMfa,
      isLoading: false
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Login Form', () => {
    it('should render login form with proper accessibility attributes', () => {
      const { getByTestId, getByRole } = render(
        <AuthForm type="login" onSuccess={mockOnSuccess} onError={mockOnError} />
      );

      const emailInput = getByTestId('auth-email-input');
      const passwordInput = getByTestId('auth-password-input');
      const submitButton = getByTestId('auth-submit-button');

      expect(emailInput).toHaveAccessibilityRole('textbox');
      expect(passwordInput).toHaveAccessibilityRole('textbox');
      expect(submitButton).toHaveAccessibilityRole('button');
    });

    it('should validate email format', async () => {
      const { getByTestId } = render(
        <AuthForm type="login" onSuccess={mockOnSuccess} onError={mockOnError} />
      );

      const emailInput = getByTestId('auth-email-input');
      const submitButton = getByTestId('auth-submit-button');

      fireEvent.changeText(emailInput, 'invalid-email');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockLogin).not.toHaveBeenCalled();
        expect(emailInput).toHaveProp('error', 'Invalid email format');
      });
    });

    it('should validate password complexity requirements', async () => {
      const { getByTestId } = render(
        <AuthForm type="login" onSuccess={mockOnSuccess} onError={mockOnError} />
      );

      const passwordInput = getByTestId('auth-password-input');
      const submitButton = getByTestId('auth-submit-button');

      fireEvent.changeText(passwordInput, 'weak');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockLogin).not.toHaveBeenCalled();
        expect(passwordInput).toHaveProp('error', expect.stringContaining('Password must contain'));
      });
    });

    it('should handle successful login', async () => {
      const { getByTestId } = render(
        <AuthForm type="login" onSuccess={mockOnSuccess} onError={mockOnError} />
      );

      const emailInput = getByTestId('auth-email-input');
      const passwordInput = getByTestId('auth-password-input');
      const submitButton = getByTestId('auth-submit-button');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'StrongPass1!');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'StrongPass1!'
        });
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should handle MFA requirement', async () => {
      mockLogin.mockResolvedValueOnce({ mfaRequired: true, mfaToken: 'token123' });
      const mockOnMfaRequired = jest.fn();

      const { getByTestId } = render(
        <AuthForm 
          type="login" 
          onSuccess={mockOnSuccess} 
          onError={mockOnError}
          onMfaRequired={mockOnMfaRequired}
        />
      );

      fireEvent.changeText(getByTestId('auth-email-input'), 'test@example.com');
      fireEvent.changeText(getByTestId('auth-password-input'), 'StrongPass1!');
      fireEvent.press(getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(mockOnMfaRequired).toHaveBeenCalledWith('token123');
      });
    });
  });

  describe('Registration Form', () => {
    it('should render registration form with password confirmation', () => {
      const { getByTestId } = render(
        <AuthForm type="register" onSuccess={mockOnSuccess} onError={mockOnError} />
      );

      expect(getByTestId('auth-confirm-password-input')).toBeTruthy();
    });

    it('should validate password match', async () => {
      const { getByTestId } = render(
        <AuthForm type="register" onSuccess={mockOnSuccess} onError={mockOnError} />
      );

      fireEvent.changeText(getByTestId('auth-password-input'), 'StrongPass1!');
      fireEvent.changeText(getByTestId('auth-confirm-password-input'), 'DifferentPass1!');
      fireEvent.press(getByTestId('auth-submit-button'));

      await waitFor(() => {
        expect(mockRegister).not.toHaveBeenCalled();
        expect(getByTestId('auth-confirm-password-input')).toHaveProp('error', 'Passwords do not match');
      });
    });
  });

  describe('Security Features', () => {
    it('should implement rate limiting', async () => {
      const { getByTestId } = render(
        <AuthForm type="login" onSuccess={mockOnSuccess} onError={mockOnError} maxAttempts={3} />
      );

      for (let i = 0; i < 4; i++) {
        fireEvent.press(getByTestId('auth-submit-button'));
      }

      await waitFor(() => {
        expect(getByTestId('auth-submit-button')).toBeDisabled();
      });
    });

    it('should clear sensitive data on unmount', () => {
      const { unmount, getByTestId } = render(
        <AuthForm type="login" onSuccess={mockOnSuccess} onError={mockOnError} />
      );

      const emailInput = getByTestId('auth-email-input');
      const passwordInput = getByTestId('auth-password-input');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'StrongPass1!');

      unmount();

      const { getByTestId: getByTestIdAfterRemount } = render(
        <AuthForm type="login" onSuccess={mockOnSuccess} onError={mockOnError} />
      );

      expect(getByTestIdAfterRemount('auth-email-input')).toHaveProp('value', '');
      expect(getByTestIdAfterRemount('auth-password-input')).toHaveProp('value', '');
    });
  });
});

describe('BiometricPrompt Component', () => {
  const mockOnClose = jest.fn();
  const mockLoginWithBiometrics = jest.fn();

  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      loginWithBiometrics: mockLoginWithBiometrics
    });
  });

  it('should render biometric prompt with proper accessibility', () => {
    const { getByRole } = render(
      <BiometricPrompt 
        visible={true} 
        onClose={mockOnClose}
        accessibilityConfig={{
          label: 'Biometric authentication',
          hint: 'Use fingerprint to login'
        }}
      />
    );

    expect(getByRole('header')).toBeTruthy();
    expect(getByRole('button')).toHaveAccessibilityLabel('Authenticate');
  });

  it('should handle successful biometric authentication', async () => {
    mockLoginWithBiometrics.mockResolvedValueOnce({});
    
    const { getByRole } = render(
      <BiometricPrompt visible={true} onClose={mockOnClose} />
    );

    fireEvent.press(getByRole('button', { name: 'Authenticate' }));

    await waitFor(() => {
      expect(mockLoginWithBiometrics).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should handle biometric authentication failure', async () => {
    mockLoginWithBiometrics.mockRejectedValueOnce(new Error('Authentication failed'));
    
    const { getByRole, getByText } = render(
      <BiometricPrompt visible={true} onClose={mockOnClose} />
    );

    fireEvent.press(getByRole('button', { name: 'Authenticate' }));

    await waitFor(() => {
      expect(getByText('Authentication failed')).toBeTruthy();
    });
  });

  it('should enforce maximum attempts limit', async () => {
    mockLoginWithBiometrics.mockRejectedValue(new Error('Authentication failed'));
    
    const { getByRole, getByText } = render(
      <BiometricPrompt visible={true} onClose={mockOnClose} maxAttempts={2} />
    );

    const authButton = getByRole('button', { name: 'Authenticate' });

    // First attempt
    fireEvent.press(authButton);
    await waitFor(() => {
      expect(getByText('Authentication failed')).toBeTruthy();
    });

    // Second attempt
    fireEvent.press(authButton);
    await waitFor(() => {
      expect(getByText('Too many failed attempts')).toBeTruthy();
      expect(authButton).toBeDisabled();
    });
  });
});

describe('Accessibility Compliance', () => {
  it('should meet WCAG 2.1 standards for AuthForm', async () => {
    const { container } = render(
      <AuthForm type="login" onSuccess={jest.fn()} onError={jest.fn()} />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should meet WCAG 2.1 standards for BiometricPrompt', async () => {
    const { container } = render(
      <BiometricPrompt visible={true} onClose={jest.fn()} />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});