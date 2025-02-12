import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import AuthHeader from '../../components/auth/AuthHeader';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { authService } from '../../services/api/auth';
import { useTheme } from '../../hooks/useTheme';
import { VALIDATION_RULES, RATE_LIMITS } from '../../config/constants';

interface ForgotPasswordScreenProps {}

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = () => {
  // State management
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastAttempt, setLastAttempt] = useState(0);

  // Hooks
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Reset state when screen gains focus
  useEffect(() => {
    if (isFocused) {
      setError('');
      setLoading(false);
    }
  }, [isFocused]);

  // Rate limiting check
  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastAttempt;
    const minWaitTime = (60000 / RATE_LIMITS.AUTH.requests); // Time between allowed requests

    if (timeSinceLastAttempt < minWaitTime) {
      throw new Error(`Please wait ${Math.ceil((minWaitTime - timeSinceLastAttempt) / 1000)} seconds before trying again`);
    }
    return true;
  }, [lastAttempt]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    try {
      setError('');
      setLoading(true);

      // Rate limiting check
      checkRateLimit();

      // Validate email format
      if (!VALIDATION_RULES.EMAIL_PATTERN.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Update rate limiting timestamp
      setLastAttempt(Date.now());

      // Call auth service
      const response = await authService.forgotPassword(email);

      // Success handling
      if (response.success) {
        Alert.alert(
          'Password Reset',
          'If an account exists with this email, you will receive password reset instructions shortly.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    } catch (err) {
      // Error handling
      const errorMessage = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      setError(errorMessage);

      // Accessibility announcement for error
      if (Platform.OS === 'ios') {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [email, navigation, checkRateLimit]);

  return (
    <View 
      style={styles.container}
      accessibilityRole="none"
      testID="forgot-password-screen"
    >
      <AuthHeader
        title="Reset Password"
        subtitle="Enter your email to receive password reset instructions"
        testID="forgot-password-header"
      />

      <View style={styles.form}>
        <Input
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={true}
          error={error}
          disabled={loading}
          accessibilityLabel="Email input"
          testID="forgot-password-email-input"
        />

        <Button
          label="Reset Password"
          onPress={handleSubmit}
          loading={loading}
          disabled={!email.trim() || loading}
          variant="primary"
          size="large"
          accessibilityLabel="Reset password button"
          testID="forgot-password-submit-button"
        />

        <Button
          label="Back to Login"
          onPress={() => navigation.goBack()}
          variant="ghost"
          size="medium"
          accessibilityLabel="Back to login button"
          testID="forgot-password-back-button"
        />
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  form: {
    width: '100%',
    maxWidth: theme.breakpoints.tablet,
    marginTop: theme.spacing.xl,
    gap: theme.spacing.md,
  }
});

export default ForgotPasswordScreen;