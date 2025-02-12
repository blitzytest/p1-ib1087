import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, Platform, AccessibilityInfo } from 'react-native'; // ^0.71+
import { useNavigation, useIsFocused } from '@react-navigation/native'; // ^6.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import Analytics from '@segment/analytics-react-native'; // ^2.0.0

import AuthForm from '../../components/auth/AuthForm';
import BiometricPrompt from '../../components/auth/BiometricPrompt';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { AuthStackNavigationProp } from '../../types/navigation';

interface LoginScreenProps {
  testID?: string;
  initialEmail?: string;
}

const LoginScreen: React.FC<LoginScreenProps> = ({
  testID = 'login-screen',
  initialEmail
}) => {
  const navigation = useNavigation<AuthStackNavigationProp>();
  const isFocused = useIsFocused();
  const { theme } = useTheme();
  const {
    login,
    loginWithBiometrics,
    isLoading,
    error: authError,
    securityMetrics
  } = useAuth();

  // State management
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  // Check biometric availability on mount
  useEffect(() => {
    if (isFocused) {
      AccessibilityInfo.announceForAccessibility('Login screen');
    }
  }, [isFocused]);

  // Handle successful login
  const handleLoginSuccess = useCallback(async (credentials: {
    email: string;
    password: string;
    useBiometrics?: boolean;
  }) => {
    try {
      await login(credentials, credentials.useBiometrics);

      // Track successful login
      Analytics.track('User Login', {
        method: 'password',
        useBiometrics: credentials.useBiometrics,
        timestamp: new Date().toISOString()
      });

      // Navigate to dashboard
      navigation.replace('Main');
    } catch (error) {
      console.error('Login error:', error);
      
      // Track login failure
      Analytics.track('Login Failed', {
        error: error.message,
        attempts: securityMetrics.failedAttempts,
        timestamp: new Date().toISOString()
      });
    }
  }, [login, navigation, securityMetrics.failedAttempts]);

  // Handle biometric authentication
  const handleBiometricPrompt = useCallback(async () => {
    try {
      await loginWithBiometrics();

      Analytics.track('User Login', {
        method: 'biometric',
        timestamp: new Date().toISOString()
      });

      navigation.replace('Main');
    } catch (error) {
      console.error('Biometric login error:', error);
      
      Analytics.track('Biometric Login Failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }, [loginWithBiometrics, navigation]);

  // Handle form submission
  const handleSubmit = useCallback(async (credentials: {
    email: string;
    password: string;
    useBiometrics: boolean;
  }) => {
    if (credentials.useBiometrics) {
      setLoginCredentials(credentials);
      setShowBiometricPrompt(true);
    } else {
      await handleLoginSuccess(credentials);
    }
  }, [handleLoginSuccess]);

  // Error boundary fallback
  const ErrorFallback = useCallback(({ error, resetErrorBoundary }) => (
    <View style={styles.errorContainer}>
      <Text style={[styles.errorText, { color: theme.colors.status.error }]}>
        {error.message}
      </Text>
      <Button
        label="Try Again"
        onPress={resetErrorBoundary}
        variant="primary"
        testID="error-retry-button"
      />
    </View>
  ), [theme]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <SafeAreaView 
        style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
        testID={testID}
      >
        <View style={styles.formContainer}>
          <AuthForm
            onSubmit={handleSubmit}
            onBiometricRequest={handleBiometricPrompt}
            error={authError?.message}
            initialEmail={initialEmail}
            isLoading={isLoading}
            testID="login-form"
          />
        </View>

        <BiometricPrompt
          visible={showBiometricPrompt}
          onClose={() => setShowBiometricPrompt(false)}
          credentials={loginCredentials}
          enablePrompt={true}
          maxAttempts={3}
          accessibilityConfig={{
            label: 'Biometric login prompt',
            hint: 'Enable biometric authentication for faster login',
            announceResult: true
          }}
          testID="biometric-prompt"
        />
      </SafeAreaView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center'
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorText: {
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 16
  }
});

export default LoginScreen;