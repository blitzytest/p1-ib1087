import React, { useCallback, useState, useEffect } from 'react';
import { View, StyleSheet, AccessibilityInfo } from 'react-native'; // 0.71+
import { useNavigation } from '@react-navigation/native'; // ^6.0.0
import AccountForm from '../../components/accounts/AccountForm';
import PlaidLink from '../../components/accounts/PlaidLink';
import { useAccounts } from '../../hooks/useAccounts';
import { useTheme } from '../../hooks/useTheme';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

/**
 * Enhanced screen component for adding new financial accounts
 * Implements F-201 Account Linking requirement with comprehensive error handling
 */
const AddAccountScreen: React.FC = React.memo(() => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { linkAccount, loading, error } = useAccounts();
  const [connectionStartTime, setConnectionStartTime] = useState<number | null>(null);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const MAX_RETRY_ATTEMPTS = 3;

  // Track connection duration for performance monitoring
  useEffect(() => {
    if (loading && !connectionStartTime) {
      setConnectionStartTime(Date.now());
    } else if (!loading && connectionStartTime) {
      const duration = Date.now() - connectionStartTime;
      if (duration > PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME) {
        console.warn('Account connection exceeded performance threshold:', duration);
      }
      setConnectionStartTime(null);
    }
  }, [loading, connectionStartTime]);

  /**
   * Handles successful account linking through Plaid
   * Implements F-201-RQ-001 for successful Plaid handshake
   */
  const handleAccountSuccess = useCallback(async (metadata: {
    id: string;
    name: string;
  }) => {
    try {
      // Track successful connection metrics
      const duration = connectionStartTime ? Date.now() - connectionStartTime : 0;
      console.log('Account connection successful:', {
        duration,
        institutionName: metadata.name
      });

      // Announce success to screen readers
      AccessibilityInfo.announceForAccessibility(
        `Successfully connected account with ${metadata.name}`
      );

      // Navigate back to accounts list
      navigation.goBack();
    } catch (error) {
      console.error('Error handling account success:', error);
      handleAccountError(error as Error);
    }
  }, [navigation, connectionStartTime]);

  /**
   * Enhanced error handler for account linking failures
   * Implements F-201-RQ-003 for comprehensive error handling
   */
  const handleAccountError = useCallback(async (error: Error) => {
    // Log error for tracking
    console.error('Account linking error:', {
      error,
      attempts: retryAttempts + 1
    });

    if (retryAttempts < MAX_RETRY_ATTEMPTS) {
      setRetryAttempts(prev => prev + 1);
      
      // Announce retry attempt to screen readers
      AccessibilityInfo.announceForAccessibility(
        `Connection failed. Retrying attempt ${retryAttempts + 1} of ${MAX_RETRY_ATTEMPTS}`
      );
    } else {
      // Announce failure to screen readers
      AccessibilityInfo.announceForAccessibility(
        'Account connection failed after multiple attempts. Please try again later.'
      );
    }
  }, [retryAttempts]);

  /**
   * Handles Plaid connection timeout scenarios
   */
  const handleTimeout = useCallback(() => {
    console.warn('Account connection timed out');
    
    // Announce timeout to screen readers
    AccessibilityInfo.announceForAccessibility(
      'Connection timed out. Please try again.'
    );
  }, []);

  return (
    <View 
      style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
      accessibilityRole="main"
      accessibilityLabel="Add bank account screen"
    >
      <View 
        style={styles.header}
        accessibilityRole="header"
      >
        <Text style={[
          styles.headerText,
          { color: theme.colors.text.primary }
        ]}>
          Connect Your Bank
        </Text>
      </View>

      <AccountForm
        onSuccess={handleAccountSuccess}
        onError={handleAccountError}
        onTimeout={handleTimeout}
        retryLimit={MAX_RETRY_ATTEMPTS}
        timeoutDuration={PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME}
      />

      {error && (
        <View 
          style={[styles.errorContainer, { backgroundColor: theme.colors.status.errorLight }]}
          accessibilityRole="alert"
        >
          <Text style={[
            styles.errorText,
            { color: theme.colors.status.error }
          ]}>
            {error.message}
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'transparent',
  },
  header: {
    marginBottom: 24,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

AddAccountScreen.displayName = 'AddAccountScreen';

export default AddAccountScreen;