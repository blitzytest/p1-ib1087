import React, { useMemo, useCallback } from 'react';
import { StyleSheet, View, RefreshControl } from 'react-native';
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { VirtualizedList, Animated } from 'react-native'; // 0.71+
import { Skeleton } from '@mui/material'; // ^5.0.0
import Card from '../common/Card';
import { useAccounts } from '../../hooks/useAccounts';
import { Account, AccountType } from '../../types/models';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

// Props interface for the AccountsSummary component
interface AccountsSummaryProps {
  showAddButton?: boolean;
  onAddAccount?: () => void;
  enableRefresh?: boolean;
  refreshConfig?: {
    maxAttempts: number;
    delayMs: number;
  };
}

// Interface for account totals by type
interface AccountTotals {
  [AccountType.CHECKING]: number;
  [AccountType.SAVINGS]: number;
  [AccountType.CREDIT]: number;
  [AccountType.INVESTMENT]: number;
}

/**
 * Custom hook for memoized account totals calculation
 */
const useMemoizedTotals = (accounts: Account[]): AccountTotals => {
  return useMemo(() => {
    const startTime = performance.now();
    
    const totals = accounts.reduce((acc, account) => ({
      ...acc,
      [account.type]: (acc[account.type] || 0) + account.balance
    }), {} as AccountTotals);

    // Performance monitoring
    const duration = performance.now() - startTime;
    if (duration > PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME) {
      console.warn('Account totals calculation exceeded threshold', { duration });
    }

    return totals;
  }, [accounts]);
};

/**
 * Custom hook for handling refresh operations
 */
const useRefreshHandler = (config?: AccountsSummaryProps['refreshConfig']) => {
  const [refreshing, setRefreshing] = React.useState(false);
  const [attempts, setAttempts] = React.useState(0);
  const { refetch } = useAccounts();

  const handleRefresh = useCallback(async () => {
    if (refreshing || (config?.maxAttempts && attempts >= config.maxAttempts)) {
      return;
    }

    try {
      setRefreshing(true);
      await refetch();
      setAttempts(0);
    } catch (error) {
      setAttempts(prev => prev + 1);
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, attempts, config?.maxAttempts, refetch]);

  return { refreshing, handleRefresh };
};

/**
 * Error fallback component for error boundary
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({ 
  error, 
  resetErrorBoundary 
}) => (
  <Card
    accessibilityLabel="Error loading accounts"
    style={styles.errorContainer}
  >
    <View>
      <Text style={styles.errorText}>Error loading accounts</Text>
      <Text style={styles.errorDetail}>{error.message}</Text>
      <TouchableOpacity 
        onPress={resetErrorBoundary}
        accessibilityLabel="Retry loading accounts"
        style={styles.retryButton}
      >
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  </Card>
);

/**
 * AccountsSummary component displays a summary of all user's financial accounts
 */
const AccountsSummary: React.FC<AccountsSummaryProps> = ({
  showAddButton = true,
  onAddAccount,
  enableRefresh = true,
  refreshConfig
}) => {
  // Fetch accounts data
  const { accounts, loading, error } = useAccounts();
  
  // Calculate totals
  const totals = useMemoizedTotals(accounts);
  
  // Setup refresh handler
  const { refreshing, handleRefresh } = useRefreshHandler(refreshConfig);

  // Animation value for loading state
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Handle loading animation
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: loading ? 0.5 : 1,
      duration: 200,
      useNativeDriver: true
    }).start();
  }, [loading, fadeAnim]);

  // Render item for VirtualizedList
  const renderAccountItem = useCallback(({ item }: { item: Account }) => (
    <Card
      key={item.id}
      style={styles.accountCard}
      accessibilityLabel={`${item.name} account with balance ${item.balance} ${item.currency}`}
    >
      <View style={styles.accountRow}>
        <Text style={styles.accountName}>{item.name}</Text>
        <Text style={styles.accountBalance}>
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: item.currency
          }).format(item.balance)}
        </Text>
      </View>
    </Card>
  ), []);

  // Loading skeleton
  if (loading) {
    return (
      <View style={styles.container}>
        <Skeleton variant="rectangular" height={100} />
        <Skeleton variant="rectangular" height={60} style={styles.skeletonItem} />
        <Skeleton variant="rectangular" height={60} style={styles.skeletonItem} />
      </View>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <Animated.View 
        style={[styles.container, { opacity: fadeAnim }]}
        accessibilityRole="summary"
        accessibilityLabel="Accounts summary"
      >
        <Card style={styles.totalCard}>
          <Text style={styles.totalTitle}>Total Balance</Text>
          <Text style={styles.totalAmount}>
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD'
            }).format(Object.values(totals).reduce((a, b) => a + b, 0))}
          </Text>
        </Card>

        <VirtualizedList
          data={accounts}
          renderItem={renderAccountItem}
          keyExtractor={(item: Account) => item.id}
          getItemCount={() => accounts.length}
          getItem={(data, index) => accounts[index]}
          refreshControl={enableRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#00A6A4"
            />
          ) : undefined}
          ListFooterComponent={showAddButton && onAddAccount ? (
            <TouchableOpacity
              style={styles.addButton}
              onPress={onAddAccount}
              accessibilityLabel="Add new account"
            >
              <Text style={styles.addButtonText}>Add Account</Text>
            </TouchableOpacity>
          ) : null}
        />
      </Animated.View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16
  },
  totalCard: {
    marginBottom: 16
  },
  totalTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4F6D7A'
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0B3954',
    marginTop: 8
  },
  accountCard: {
    marginBottom: 8
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  accountName: {
    fontSize: 16,
    color: '#0B3954'
  },
  accountBalance: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00A6A4'
  },
  addButton: {
    backgroundColor: '#00A6A4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#FEE2E2'
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626'
  },
  errorDetail: {
    fontSize: 14,
    color: '#7F1D1D',
    marginTop: 8
  },
  retryButton: {
    backgroundColor: '#DC2626',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 16
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  skeletonItem: {
    marginTop: 8
  }
});

export default React.memo(AccountsSummary);