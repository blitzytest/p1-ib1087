import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, AccessibilityInfo } from 'react-native'; // 0.71+
import PlaidLink from './PlaidLink';
import Input from '../common/Input';
import { useAccounts } from '../../hooks/useAccounts';
import { useTheme } from '../../hooks/useTheme';
import { PlaidLinkMetadata } from '../../types/api';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

interface AccountFormProps {
  onSuccess: (accountData: { id: string; name: string }) => void;
  onError?: (error: Error) => void;
  onTimeout?: () => void;
  retryLimit?: number;
  timeoutDuration?: number;
}

/**
 * Enhanced account form component for connecting financial accounts via Plaid
 * Implements F-201 Account Linking requirement with comprehensive error handling
 */
const AccountForm: React.FC<AccountFormProps> = React.memo(({
  onSuccess,
  onError,
  onTimeout,
  retryLimit = 3,
  timeoutDuration = PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME,
}) => {
  const { theme } = useTheme();
  const { linkAccount, loading, error: accountError } = useAccounts();
  const [syncStartTime, setSyncStartTime] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Track sync duration for performance monitoring
  useEffect(() => {
    if (loading && !syncStartTime) {
      setSyncStartTime(Date.now());
    } else if (!loading && syncStartTime) {
      const duration = Date.now() - syncStartTime;
      if (duration > timeoutDuration) {
        console.warn('Account sync exceeded timeout threshold:', duration);
        onTimeout?.();
      }
      setSyncStartTime(null);
    }
  }, [loading, syncStartTime, timeoutDuration, onTimeout]);

  /**
   * Handles successful Plaid account linking
   * Implements F-201-RQ-001 for successful Plaid handshake
   */
  const handlePlaidSuccess = useCallback(async (plaidData: {
    publicToken: string;
    metadata: PlaidLinkMetadata;
  }) => {
    try {
      const startTime = Date.now();
      
      const result = await linkAccount({
        publicToken: plaidData.publicToken,
        institutionId: plaidData.metadata.institution.id,
        accountIds: plaidData.metadata.accounts.map(acc => acc.id),
        metadata: plaidData.metadata
      });

      const duration = Date.now() - startTime;
      if (duration > PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME) {
        console.warn('Account linking exceeded performance threshold:', duration);
      }

      // Announce success to screen readers
      AccessibilityInfo.announceForAccessibility(
        'Account successfully connected'
      );

      onSuccess({
        id: result.id,
        name: plaidData.metadata.institution.name
      });
    } catch (error) {
      console.error('Account linking failed:', error);
      handlePlaidError(error as Error);
    }
  }, [linkAccount, onSuccess]);

  /**
   * Enhanced error handler with retry logic
   * Implements F-201-RQ-003 for comprehensive error handling
   */
  const handlePlaidError = useCallback((error: Error) => {
    if (retryCount < retryLimit) {
      setRetryCount(prev => prev + 1);
      console.warn(`Retrying account link attempt ${retryCount + 1}/${retryLimit}`);
      
      // Announce retry attempt to screen readers
      AccessibilityInfo.announceForAccessibility(
        `Connection failed. Retrying attempt ${retryCount + 1} of ${retryLimit}`
      );
    } else {
      onError?.(error);
      
      // Announce failure to screen readers
      AccessibilityInfo.announceForAccessibility(
        'Account connection failed. Please try again later.'
      );
    }
  }, [retryCount, retryLimit, onError]);

  return (
    <View 
      style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
      accessibilityRole="form"
      accessibilityLabel="Connect bank account form"
    >
      <PlaidLink
        onSuccess={handlePlaidSuccess}
        onError={handlePlaidError}
        onTimeout={onTimeout}
        timeout={timeoutDuration}
      />

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={theme.colors.brand.primary}
          />
        </View>
      )}

      {accountError && (
        <View 
          style={styles.errorContainer}
          accessibilityRole="alert"
        >
          <Input
            value={accountError}
            onChangeText={() => {}}
            disabled
            error={accountError}
            accessibilityLabel="Error message"
          />
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
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  errorContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
});

AccountForm.displayName = 'AccountForm';

export default AccountForm;