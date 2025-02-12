import React from 'react';
import { StyleSheet, View, FlatList, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ErrorBoundary } from 'react-error-boundary';
import analytics from '@react-native-firebase/analytics';

import AccountCard from '../../components/accounts/AccountCard';
import Loading from '../../components/common/Loading';
import { useAccounts } from '../../hooks/useAccounts';
import { useTheme } from '../../hooks/useTheme';
import { Account } from '../../types/models';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

interface AccountsListScreenProps {
  testID?: string;
  accessibilityLabel?: string;
}

const AccountsListScreen: React.FC<AccountsListScreenProps> = React.memo(({ 
  testID = 'accounts-list-screen',
  accessibilityLabel = 'Your financial accounts'
}) => {
  // Hooks
  const navigation = useNavigation();
  const { theme, currentBreakpoint } = useTheme();
  const { accounts, loading, error, fetchAccounts, syncAccount } = useAccounts();

  // Styles
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Track screen view
  React.useEffect(() => {
    const trackScreenView = async () => {
      await analytics().logScreenView({
        screen_name: 'AccountsList',
        screen_class: 'AccountsListScreen'
      });
    };
    trackScreenView();
  }, []);

  // Memoized handlers
  const handleRefresh = React.useCallback(async () => {
    const startTime = Date.now();
    await fetchAccounts();
    
    // Performance monitoring
    const duration = Date.now() - startTime;
    if (duration > PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME) {
      console.warn('Account refresh exceeded performance threshold', { duration });
    }
  }, [fetchAccounts]);

  const handleAccountPress = React.useCallback((account: Account) => {
    analytics().logEvent('account_selected', {
      account_id: account.id,
      account_type: account.type
    });
    navigation.navigate('AccountDetails', { accountId: account.id });
  }, [navigation]);

  // Memoized render functions
  const renderAccountCard = React.useCallback(({ item: account }: { item: Account }) => (
    <AccountCard
      account={account}
      onPress={() => handleAccountPress(account)}
      testID={`account-card-${account.id}`}
      isRTL={false}
      isDarkMode={false}
    />
  ), [handleAccountPress]);

  const keyExtractor = React.useCallback((item: Account) => item.id, []);

  const ListEmptyComponent = React.useCallback(() => (
    <View style={styles.emptyContainer}>
      {!loading && !error && (
        <View 
          style={styles.emptyContent}
          accessibilityLabel="No accounts found. Add an account to get started."
          accessibilityRole="text"
        >
          <Text style={styles.emptyText}>No accounts found</Text>
          <Text style={styles.emptySubtext}>Add an account to get started</Text>
        </View>
      )}
    </View>
  ), [loading, error, styles]);

  const ErrorFallback = React.useCallback(({ error }: { error: Error }) => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>Error: {error.message}</Text>
      <Button 
        title="Retry" 
        onPress={handleRefresh}
        accessibilityLabel="Retry loading accounts"
      />
    </View>
  ), [handleRefresh, styles]);

  // Loading state
  if (loading && !accounts.length) {
    return <Loading size="large" fullscreen accessibilityLabel="Loading your accounts" />;
  }

  // Error state
  if (error && !accounts.length) {
    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button 
            title="Retry" 
            onPress={handleRefresh}
            accessibilityLabel="Retry loading accounts"
          />
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <View 
      style={styles.container}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      <FlatList
        data={accounts}
        renderItem={renderAccountCard}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            colors={[theme.colors.brand.primary]}
            progressBackgroundColor={theme.colors.background.primary}
          />
        }
        initialNumToRender={5}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({
          length: 100,
          offset: 100 * index,
          index,
        })}
        accessibilityRole="list"
        accessibilityLabel="List of your financial accounts"
      />
    </View>
  );
});

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  listContent: {
    padding: theme.spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  emptyContent: {
    alignItems: 'center',
  },
  emptyText: {
    ...theme.typography.fontFamily.medium,
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  emptySubtext: {
    ...theme.typography.fontFamily.regular,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background.primary,
  },
  errorText: {
    ...theme.typography.fontFamily.medium,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.status.error,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
});

export default AccountsListScreen;