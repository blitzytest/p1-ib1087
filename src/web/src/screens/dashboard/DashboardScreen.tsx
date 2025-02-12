import React, { useEffect, useCallback, useMemo } from 'react';
import { 
  ScrollView, 
  RefreshControl, 
  StyleSheet, 
  AccessibilityInfo,
  View
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import analytics from '@react-native-firebase/analytics';

// Internal components
import AccountsSummary from '../../components/dashboard/AccountsSummary';
import BudgetProgress from '../../components/dashboard/BudgetProgress';
import NetWorthCard from '../../components/dashboard/NetWorthCard';
import RecentTransactions from '../../components/dashboard/RecentTransactions';

// Hooks and utilities
import { useAccounts } from '../../hooks/useAccounts';
import { useTheme } from '../../hooks/useTheme';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

/**
 * Main dashboard screen component that displays a comprehensive financial overview
 * Implements real-time data synchronization, performance optimization, and accessibility
 */
const DashboardScreen: React.FC = React.memo(() => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { 
    accounts, 
    loading: accountsLoading, 
    error: accountsError,
    refreshAccounts 
  } = useAccounts();

  // Track component mount performance
  useEffect(() => {
    const startTime = performance.now();

    // Announce screen for accessibility
    AccessibilityInfo.announceScreenReader('Dashboard Screen Loaded');

    // Track screen view
    analytics().logScreenView({
      screen_name: 'Dashboard',
      screen_class: 'DashboardScreen'
    });

    return () => {
      const loadTime = performance.now() - startTime;
      if (loadTime > PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME) {
        console.warn('Dashboard load time exceeded threshold:', loadTime);
      }
    };
  }, []);

  // Handle refresh functionality
  const [refreshing, setRefreshing] = React.useState(false);
  const handleRefresh = useCallback(async () => {
    const startTime = performance.now();
    setRefreshing(true);

    try {
      await refreshAccounts();
      analytics().logEvent('dashboard_refreshed');
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
      const refreshTime = performance.now() - startTime;
      analytics().logEvent('dashboard_refresh_completed', { duration: refreshTime });
    }
  }, [refreshAccounts]);

  // Memoize handlers for child components
  const handleAddAccount = useCallback(() => {
    analytics().logEvent('add_account_initiated');
    navigation.navigate('AddAccount' as never);
  }, [navigation]);

  const handleTransactionPress = useCallback((transaction: any) => {
    analytics().logEvent('transaction_selected', { transactionId: transaction.id });
    navigation.navigate('TransactionDetail' as never, { transactionId: transaction.id } as never);
  }, [navigation]);

  // Memoize styles based on theme
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.brand.primary}
        />
      }
      accessibilityRole="scrollview"
      accessibilityLabel="Dashboard overview"
      testID="dashboard-screen"
    >
      <View style={styles.content}>
        {/* Net Worth Overview */}
        <NetWorthCard
          accounts={accounts}
          isLoading={accountsLoading}
          onError={(error) => {
            console.error('NetWorth Error:', error);
            analytics().logEvent('net_worth_error', { error: error.message });
          }}
          onRefresh={handleRefresh}
        />

        {/* Accounts Summary */}
        <AccountsSummary
          showAddButton={true}
          onAddAccount={handleAddAccount}
          enableRefresh={true}
          refreshConfig={{
            maxAttempts: 3,
            delayMs: 1000
          }}
        />

        {/* Budget Progress */}
        <BudgetProgress
          maxItems={5}
          onThresholdExceeded={(budget) => {
            analytics().logEvent('budget_threshold_exceeded', {
              budgetId: budget.id,
              category: budget.category
            });
          }}
        />

        {/* Recent Transactions */}
        <RecentTransactions
          limit={5}
          onTransactionPress={handleTransactionPress}
        />
      </View>
    </ScrollView>
  );
});

/**
 * Styles for the dashboard screen with theme integration
 */
const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  content: {
    padding: theme.spacing.md,
  }
});

// Display name for debugging
DashboardScreen.displayName = 'DashboardScreen';

// Export with error boundary and analytics tracking
export default DashboardScreen;