import React, { useEffect, useState, useCallback, useMemo } from 'react'; // ^18.0.0
import { 
  StyleSheet, 
  View, 
  ScrollView, 
  RefreshControl, 
  AccessibilityInfo,
  Alert,
  Platform
} from 'react-native'; // 0.71+
import { useRoute, useNavigation } from '@react-navigation/native'; // ^6.0.0
import AccountCard from '../../components/accounts/AccountCard';
import TransactionItem from '../../components/transactions/TransactionItem';
import { useAccounts } from '../../hooks/useAccounts';
import { useTheme } from '../../hooks/useTheme';
import { Transaction } from '../../types/models';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

/**
 * Props interface for the AccountDetailScreen component
 */
interface AccountDetailScreenProps {
  route: RouteProp<RootStackParamList, 'AccountDetail'>;
  navigation: NavigationProp<RootStackParamList>;
}

/**
 * State interface for account detail screen
 */
interface AccountDetailState {
  refreshing: boolean;
  loading: boolean;
  error: Error | null;
  transactions: Transaction[];
  page: number;
  hasMore: boolean;
}

const ITEMS_PER_PAGE = 20;
const SCROLL_THRESHOLD = 0.8;

/**
 * Screen component that displays detailed account information and transactions
 * with comprehensive error handling and performance optimization
 */
const AccountDetailScreen: React.FC<AccountDetailScreenProps> = ({ route, navigation }) => {
  // Theme and hooks
  const { theme } = useTheme();
  const { accountId } = route.params;
  const { accounts, syncAccount, removeAccount } = useAccounts();

  // Local state
  const [state, setState] = useState<AccountDetailState>({
    refreshing: false,
    loading: true,
    error: null,
    transactions: [],
    page: 1,
    hasMore: true
  });

  // Performance monitoring
  const startTime = React.useRef(Date.now());
  const loadTime = React.useRef<number | null>(null);

  // Find selected account
  const account = useMemo(() => 
    accounts.find(acc => acc.id === accountId),
    [accounts, accountId]
  );

  /**
   * Handles pull-to-refresh functionality with error handling
   */
  const handleRefresh = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, refreshing: true, error: null }));
      await syncAccount(accountId);
      
      // Announce refresh completion for accessibility
      AccessibilityInfo.announce('Account data refreshed');
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error as Error,
        refreshing: false
      }));
      Alert.alert('Refresh Failed', 'Unable to refresh account data');
    } finally {
      setState(prev => ({ ...prev, refreshing: false }));
    }
  }, [accountId, syncAccount]);

  /**
   * Handles account removal with confirmation
   */
  const handleRemoveAccount = useCallback(async () => {
    Alert.alert(
      'Remove Account',
      'Are you sure you want to remove this account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAccount(accountId);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to remove account');
            }
          }
        }
      ]
    );
  }, [accountId, removeAccount, navigation]);

  /**
   * Loads more transactions when scrolling
   */
  const loadMoreTransactions = useCallback(() => {
    if (!state.loading && state.hasMore) {
      setState(prev => ({ 
        ...prev, 
        loading: true,
        page: prev.page + 1 
      }));
    }
  }, [state.loading, state.hasMore]);

  // Initial data load and performance monitoring
  useEffect(() => {
    const loadData = async () => {
      try {
        await syncAccount(accountId);
        loadTime.current = Date.now() - startTime.current;
        
        // Log if load time exceeds threshold
        if (loadTime.current > PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME) {
          console.warn('Account detail load time exceeded threshold', {
            loadTime: loadTime.current
          });
        }
      } catch (error) {
        setState(prev => ({ ...prev, error: error as Error }));
      } finally {
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    loadData();

    return () => {
      // Cleanup performance monitoring
      loadTime.current = null;
    };
  }, [accountId, syncAccount]);

  // Memoized styles
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!account) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Account not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={state.refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.brand.primary}
        />
      }
      onScroll={({ nativeEvent }) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        const scrollPosition = 
          (contentOffset.y + layoutMeasurement.height) / contentSize.height;
        
        if (scrollPosition > SCROLL_THRESHOLD) {
          loadMoreTransactions();
        }
      }}
      scrollEventThrottle={16}
      accessible={true}
      accessibilityLabel="Account details and transactions"
    >
      <View style={styles.header}>
        <AccountCard
          account={account}
          onPress={handleRefresh}
          testID="account-detail-card"
        />
      </View>

      <View style={styles.transactionsContainer}>
        {state.transactions.map((transaction, index) => (
          <TransactionItem
            key={`${transaction.id}-${index}`}
            transaction={transaction}
            testID={`transaction-item-${index}`}
          />
        ))}

        {state.loading && (
          <View style={styles.loadingContainer}>
            <TransactionItem.Skeleton />
            <TransactionItem.Skeleton />
          </View>
        )}

        {state.error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {state.error.message}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background.secondary,
  },
  transactionsContainer: {
    padding: theme.spacing.md,
  },
  loadingContainer: {
    padding: theme.spacing.md,
  },
  errorContainer: {
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...theme.typography.fontSize.md,
    color: theme.colors.status.error,
    textAlign: 'center',
  }
});

export default AccountDetailScreen;