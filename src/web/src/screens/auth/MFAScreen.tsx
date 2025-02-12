import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Alert, AccessibilityInfo } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { AuthStackNavigationProp } from '../../types/navigation';
import { ValidationResult } from '../../types';

interface MFAScreenProps {
  mfaToken: string;
  mfaType: 'sms' | 'authenticator';
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  expiresIn: number;
}

const MFAScreen: React.FC<MFAScreenProps> = ({
  mfaToken,
  mfaType,
  onSuccess,
  onError,
  expiresIn
}) => {
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [remainingTime, setRemainingTime] = useState<number>(expiresIn);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  const navigation = useNavigation<AuthStackNavigationProp>();
  const isFocused = useIsFocused();
  const { theme } = useTheme();
  const { verifyMfa } = useAuth();

  // Validate MFA code format and security requirements
  const validateMFACode = useCallback((input: string): ValidationResult => {
    if (!input) {
      return { isValid: false, error: 'Please enter verification code' };
    }

    if (input.length !== 6) {
      return { isValid: false, error: 'Code must be 6 digits' };
    }

    if (!/^\d+$/.test(input)) {
      return { isValid: false, error: 'Code must contain only numbers' };
    }

    // Check for sequential or repeated digits for security
    const sequential = '0123456789';
    const reverseSequential = '9876543210';
    if (sequential.includes(input) || reverseSequential.includes(input)) {
      return { isValid: false, error: 'Invalid code format' };
    }

    if (new Set(input.split('')).size === 1) {
      return { isValid: false, error: 'Invalid code format' };
    }

    return { isValid: true, error: '' };
  }, []);

  // Handle code submission with retry logic and security measures
  const handleSubmit = useCallback(async () => {
    try {
      if (isSubmitting) return;
      setIsSubmitting(true);
      setError('');

      // Validate code format
      const validation = validateMFACode(code);
      if (!validation.isValid) {
        setError(validation.error);
        return;
      }

      // Implement exponential backoff for retries
      const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 30000);
      await new Promise(resolve => setTimeout(resolve, backoffTime));

      // Verify MFA code
      const response = await verifyMfa({
        mfaToken,
        code,
        method: mfaType
      });

      // Handle successful verification
      if (response) {
        onSuccess?.();
        navigation.replace('Main');
      }

    } catch (error: any) {
      setRetryCount(prev => prev + 1);
      
      // Handle specific error cases
      if (error.code === 'INVALID_CODE') {
        setError('Invalid verification code. Please try again.');
      } else if (error.code === 'CODE_EXPIRED') {
        setError('Code has expired. Please request a new code.');
      } else if (error.code === 'TOO_MANY_ATTEMPTS') {
        Alert.alert(
          'Too Many Attempts',
          'Please wait before trying again.',
          [{ text: 'OK' }]
        );
      } else {
        setError('Verification failed. Please try again.');
      }

      onError?.(error);
      setCode('');
    } finally {
      setIsSubmitting(false);
    }
  }, [code, isSubmitting, mfaToken, mfaType, navigation, onError, onSuccess, retryCount, verifyMfa]);

  // Handle code expiration countdown
  useEffect(() => {
    if (!isFocused) return;

    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isFocused]);

  // Announce remaining time for accessibility
  useEffect(() => {
    if (remainingTime === 30 || remainingTime === 10) {
      AccessibilityInfo.announceForAccessibility(
        `${remainingTime} seconds remaining to enter code`
      );
    }
  }, [remainingTime]);

  // Memoized styles
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Input
          value={code}
          onChangeText={setCode}
          maxLength={6}
          keyboardType="numeric"
          placeholder="Enter 6-digit code"
          error={error}
          accessibilityLabel="Enter verification code"
          testID="mfa-code-input"
          autoFocus
        />

        <View style={styles.buttonContainer}>
          <Button
            label="Verify"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || code.length !== 6 || remainingTime <= 0}
            accessibilityLabel="Verify code"
            testID="mfa-submit-button"
          />
        </View>

        {remainingTime > 0 && (
          <View style={styles.timerContainer}>
            <Text style={styles.timerText} accessibilityRole="timer">
              Code expires in {remainingTime} seconds
            </Text>
          </View>
        )}

        {remainingTime <= 0 && (
          <Text style={styles.error} accessibilityRole="alert">
            Code has expired. Please request a new code.
          </Text>
        )}
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background.primary
  },
  form: {
    width: '100%',
    maxWidth: 400,
    gap: theme.spacing.md
  },
  buttonContainer: {
    marginTop: theme.spacing.xl
  },
  timerContainer: {
    marginTop: theme.spacing.md,
    alignItems: 'center'
  },
  timerText: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.regular
  },
  error: {
    color: theme.colors.status.error,
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily.regular
  }
});

export default MFAScreen;