import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import BiometricPrompt from '@react-native-biometrics/core'; // ^2.0.0
import Input from '../common/Input';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { VALIDATION_RULES } from '../../config/constants';
import { ValidationResult } from '../../types';

interface AuthFormProps {
  type: 'login' | 'register' | 'recovery';
  onSuccess: () => void;
  onError?: (error: { code: string; message: string }) => void;
  enableBiometrics?: boolean;
  onMfaRequired?: (token: string) => void;
  recoveryMode?: boolean;
  maxAttempts?: number;
}

interface FormState {
  email: string;
  password: string;
  confirmPassword?: string;
  mfaCode?: string;
  isLoading: boolean;
  errors: Record<string, string>;
  attempts: number;
}

const AuthForm: React.FC<AuthFormProps> = ({
  type,
  onSuccess,
  onError,
  enableBiometrics = false,
  onMfaRequired,
  recoveryMode = false,
  maxAttempts = 5
}) => {
  const { theme } = useTheme();
  const { login, register, loginWithBiometrics, resetPassword, verifyMfa } = useAuth();

  const [formState, setFormState] = useState<FormState>({
    email: '',
    password: '',
    confirmPassword: '',
    mfaCode: '',
    isLoading: false,
    errors: {},
    attempts: 0
  });

  // Reset form state when type changes
  useEffect(() => {
    setFormState({
      email: '',
      password: '',
      confirmPassword: '',
      mfaCode: '',
      isLoading: false,
      errors: {},
      attempts: 0
    });
  }, [type]);

  const validateForm = useCallback((): ValidationResult => {
    const errors: Record<string, string> = {};

    // Email validation
    if (!formState.email) {
      errors.email = 'Email is required';
    } else if (!VALIDATION_RULES.EMAIL_PATTERN.test(formState.email)) {
      errors.email = 'Invalid email format';
    }

    // Password validation
    if (!formState.password) {
      errors.password = 'Password is required';
    } else if (!VALIDATION_RULES.PASSWORD_PATTERN.test(formState.password)) {
      errors.password = 'Password must contain at least 8 characters, including uppercase, lowercase, number and special character';
    }

    // Confirm password validation for registration
    if (type === 'register' && formState.password !== formState.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // MFA code validation
    if (formState.mfaCode && formState.mfaCode.length !== 6) {
      errors.mfaCode = 'MFA code must be 6 digits';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }, [formState, type]);

  const handleSubmit = useCallback(async () => {
    try {
      // Check max attempts
      if (formState.attempts >= maxAttempts) {
        throw new Error('Maximum login attempts exceeded. Please try again later.');
      }

      const validation = validateForm();
      if (!validation.isValid) {
        setFormState(prev => ({
          ...prev,
          errors: validation.errors
        }));
        return;
      }

      setFormState(prev => ({ ...prev, isLoading: true, errors: {} }));

      switch (type) {
        case 'login':
          const loginResponse = await login({
            email: formState.email,
            password: formState.password
          });

          if (loginResponse.mfaRequired && onMfaRequired) {
            onMfaRequired(loginResponse.mfaToken);
          } else {
            onSuccess();
          }
          break;

        case 'register':
          await register({
            email: formState.email,
            password: formState.password,
            confirmPassword: formState.confirmPassword!
          });
          onSuccess();
          break;

        case 'recovery':
          await resetPassword({
            email: formState.email,
            newPassword: formState.password
          });
          onSuccess();
          break;
      }
    } catch (error: any) {
      setFormState(prev => ({
        ...prev,
        attempts: prev.attempts + 1,
        errors: {
          submit: error.message
        }
      }));
      onError?.(error);
    } finally {
      setFormState(prev => ({ ...prev, isLoading: false }));
    }
  }, [formState, type, login, register, resetPassword, validateForm, maxAttempts, onSuccess, onError, onMfaRequired]);

  const handleBiometricAuth = useCallback(async () => {
    try {
      setFormState(prev => ({ ...prev, isLoading: true, errors: {} }));
      await loginWithBiometrics();
      onSuccess();
    } catch (error: any) {
      setFormState(prev => ({
        ...prev,
        errors: {
          submit: error.message
        }
      }));
      onError?.(error);
    } finally {
      setFormState(prev => ({ ...prev, isLoading: false }));
    }
  }, [loginWithBiometrics, onSuccess, onError]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <View style={styles.form}>
        <Input
          value={formState.email}
          onChangeText={(text) => setFormState(prev => ({ ...prev, email: text }))}
          placeholder="Email"
          keyboardType="email-address"
          error={formState.errors.email}
          testID="auth-email-input"
          autoComplete="email"
          disabled={formState.isLoading}
        />

        <Input
          value={formState.password}
          onChangeText={(text) => setFormState(prev => ({ ...prev, password: text }))}
          placeholder="Password"
          secureTextEntry
          error={formState.errors.password}
          testID="auth-password-input"
          disabled={formState.isLoading}
        />

        {type === 'register' && (
          <Input
            value={formState.confirmPassword}
            onChangeText={(text) => setFormState(prev => ({ ...prev, confirmPassword: text }))}
            placeholder="Confirm Password"
            secureTextEntry
            error={formState.errors.confirmPassword}
            testID="auth-confirm-password-input"
            disabled={formState.isLoading}
          />
        )}

        {formState.errors.submit && (
          <View style={styles.error}>
            <Text style={[styles.errorText, { color: theme.colors.status.error }]}>
              {formState.errors.submit}
            </Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <Button
            label={type === 'login' ? 'Login' : type === 'register' ? 'Register' : 'Reset Password'}
            onPress={handleSubmit}
            loading={formState.isLoading}
            disabled={formState.isLoading || formState.attempts >= maxAttempts}
            testID="auth-submit-button"
          />

          {enableBiometrics && type === 'login' && Platform.OS !== 'web' && (
            <Button
              label="Use Biometrics"
              onPress={handleBiometricAuth}
              variant="secondary"
              disabled={formState.isLoading}
              style={styles.biometricButton}
              testID="auth-biometric-button"
            />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 8,
  },
  form: {
    width: '100%',
    gap: 16,
    alignItems: 'center',
  },
  buttonContainer: {
    marginTop: 24,
    gap: 12,
    width: '100%',
  },
  error: {
    marginTop: 8,
    width: '100%',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  biometricButton: {
    marginTop: 12,
  }
});

export default AuthForm;