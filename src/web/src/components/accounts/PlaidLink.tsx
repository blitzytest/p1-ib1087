import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native'; // 0.71+
import { usePlaidLink } from 'react-plaid-link'; // ^3.3.0
import Button from '../common/Button';
import { useAccounts } from '../../hooks/useAccounts';
import { PlaidLinkMetadata } from '../../types/api';

interface PlaidLinkProps {
  linkToken: string;
  onSuccess: () => void;
  onExit?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
}

/**
 * PlaidLink component for secure bank account connection
 * Implements F-201 Account Linking requirement with Plaid integration
 */
export const PlaidLink: React.FC<PlaidLinkProps> = ({
  linkToken,
  onSuccess,
  onExit,
  onError,
  timeout = 30000, // 30 second default timeout
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const { linkAccount, loading, error, retryLink } = useAccounts();

  /**
   * Handles successful Plaid Link connection
   * Implements F-201-RQ-001 for successful Plaid handshake
   */
  const handlePlaidSuccess = useCallback(async (success: {
    publicToken: string;
    metadata: PlaidLinkMetadata;
  }) => {
    try {
      const { publicToken, metadata } = success;
      
      // Extract required data from Plaid response
      const linkRequest = {
        publicToken,
        institutionId: metadata.institution.id,
        accountIds: metadata.accounts.map(account => account.id),
        metadata
      };

      // Attempt to link account through our backend
      await linkAccount(linkRequest);
      
      // Call success callback if provided
      onSuccess?.();
    } catch (err) {
      console.error('Account linking failed:', err);
      onError?.(err as Error);
      setIsRetrying(true);
    }
  }, [linkAccount, onSuccess, onError]);

  /**
   * Handles Plaid Link exit
   * Implements F-201-RQ-003 for error handling
   */
  const handlePlaidExit = useCallback((exit: {
    error?: Error;
    metadata: PlaidLinkMetadata;
  }) => {
    if (exit.error) {
      console.error('Plaid Link exit with error:', exit.error);
      onError?.(exit.error);
    }
    onExit?.();
  }, [onExit, onError]);

  /**
   * Handles Plaid Link errors
   * Implements F-201-RQ-003 for comprehensive error handling
   */
  const handlePlaidError = useCallback(async (error: Error) => {
    console.error('Plaid Link error:', error);
    onError?.(error);
    setIsRetrying(true);
  }, [onError]);

  // Configure Plaid Link
  const config = {
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: handlePlaidExit,
    onError: handlePlaidError,
    receivedRedirectUri: window.location.href,
  };

  // Initialize Plaid Link
  const { open, ready } = usePlaidLink(config);

  /**
   * Handles retry attempts for failed connections
   */
  const handleRetry = useCallback(async () => {
    setIsRetrying(false);
    if (retryLink) {
      await retryLink();
    }
    open();
  }, [open, retryLink]);

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorContainer}>
          <Button
            label="Retry Connection"
            onPress={handleRetry}
            variant="secondary"
            loading={loading}
          />
        </View>
      )}
      
      {!error && (
        <Button
          label="Connect Bank Account"
          onPress={() => open()}
          variant="primary"
          loading={loading || !ready}
          disabled={!ready}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  errorContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
});

export default PlaidLink;