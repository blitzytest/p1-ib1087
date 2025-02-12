import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { analytics } from '@segment/analytics-react-native';
import ReCAPTCHA from 'react-native-recaptcha-v2';
import validator from 'validator';

import AuthForm from '../../components/auth/AuthForm';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { SecurityLogger } from '../../utils/security';
import { VALIDATION_RULES } from '../../config/constants';
import { AuthStackNavigationProp } from '../../types/navigation';
import { ValidationResult } from '../../types';

// Security logger instance
const securityLogger = new SecurityLogger();

// CAPTCHA configuration
const CAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '';

// Rate limiting configuration
const RATE_LIMIT = {
  MAX_ATTEMPTS: 5,
  WINDOW_MS: 300000, // 5 minutes
};

interface RegistrationState {
  attempts: number;
  lastAttempt: number;
  deviceFingerprint: string | null;
  captchaToken: string | null;
}

const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<AuthStackNavigationProp>();
  const { register, isLoading } = useAuth();
  const { theme } = useTheme();

  // Local state for registration security
  const [registrationState, setRegistrationState] = useState<RegistrationState>({
    attempts: 0,
    lastAttempt: 0,
    deviceFingerprint: null,
    captchaToken: null,
  });

  // Initialize device fingerprinting on mount
  useEffect(() => {
    const initializeFingerprint = async () => {
      try {
        // Implementation would use a fingerprinting library
        const fingerprint = 'device-fingerprint';
        setRegistrationState(prev => ({
          ...prev,
          deviceFingerprint: fingerprint,
        }));
      } catch (error) {
        securityLogger.warn('Fingerprint generation failed', { error });
      }
    };

    initializeFingerprint();
  }, []);

  // Validate registration input with comprehensive rules
  const validateRegistrationInput = useCallback((data: {
    email: string;
    password: string;
    confirmPassword: string;
  }): ValidationResult => {
    const errors: Record<string, string> = {};

    // Email validation
    if (!data.email) {
      errors.email = 'Email is required';
    } else if (!validator.isEmail(data.email)) {
      errors.email = 'Invalid email format';
    }

    // Password validation
    if (!data.password) {
      errors.password = 'Password is required';
    } else if (!VALIDATION_RULES.PASSWORD_PATTERN.test(data.password)) {
      errors.password = 'Password must contain at least 8 characters, including uppercase, lowercase, number and special character';
    }

    // Confirm password validation
    if (data.password !== data.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // CAPTCHA validation
    if (!registrationState.captchaToken) {
      errors.captcha = 'Please complete the CAPTCHA verification';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }, [registrationState.captchaToken]);

  // Handle successful registration
  const handleRegistrationSuccess = useCallback(async () => {
    try {
      // Track successful registration
      analytics.track('User Registration', {
        timestamp: new Date().toISOString(),
        deviceFingerprint: registrationState.deviceFingerprint,
      });

      // Log security event
      securityLogger.info('Registration successful', {
        deviceFingerprint: registrationState.deviceFingerprint,
      });

      // Navigate to MFA setup if required
      navigation.navigate('MFA', { token: 'mfa-setup-token' });
    } catch (error) {
      securityLogger.error('Registration success handling failed', { error });
    }
  }, [navigation, registrationState.deviceFingerprint]);

  // Handle registration form submission
  const handleRegister = useCallback(async (formData: {
    email: string;
    password: string;
    confirmPassword: string;
  }) => {
    try {
      // Check rate limiting
      const now = Date.now();
      if (
        registrationState.attempts >= RATE_LIMIT.MAX_ATTEMPTS &&
        now - registrationState.lastAttempt < RATE_LIMIT.WINDOW_MS
      ) {
        throw new Error('Too many registration attempts. Please try again later.');
      }

      // Validate input
      const validation = validateRegistrationInput(formData);
      if (!validation.isValid) {
        return validation;
      }

      // Update attempt counter
      setRegistrationState(prev => ({
        ...prev,
        attempts: prev.attempts + 1,
        lastAttempt: now,
      }));

      // Attempt registration
      await register({
        ...formData,
        deviceFingerprint: registrationState.deviceFingerprint || undefined,
        captchaToken: registrationState.captchaToken || undefined,
      });

      await handleRegistrationSuccess();
    } catch (error) {
      securityLogger.warn('Registration attempt failed', {
        error,
        attempts: registrationState.attempts,
      });
      throw error;
    }
  }, [register, registrationState, validateRegistrationInput, handleRegistrationSuccess]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <AuthForm
        type="register"
        onSuccess={handleRegistrationSuccess}
      />
      
      <ReCAPTCHA
        siteKey={CAPTCHA_SITE_KEY}
        onVerify={(token: string) => {
          setRegistrationState(prev => ({
            ...prev,
            captchaToken: token,
          }));
        }}
      />

      {isLoading && (
        <View style={[styles.loadingOverlay, { backgroundColor: theme.colors.background.overlay }]} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});

export default RegisterScreen;