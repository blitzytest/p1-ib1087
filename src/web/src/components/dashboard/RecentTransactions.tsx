import React, { useEffect, useCallback, memo } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import styled from 'styled-components';
import analytics from '@react-native-firebase/analytics';
import { ErrorBoundary } from 'react-error-boundary';
import { SkeletonLoader } from '@ui-kitten/components';

import TransactionItem from '../transactions/TransactionItem';
import { Transaction } from '../../types/models';
import { useTransactions } from '../../hooks/useTransactions';
import { useTheme } from '../../hooks/useTheme';

// Props interface for the component
interface RecentTransactionsProps {
  /** Maximum number of transactions to display */
  limit: number;
  /** Callback for transaction item press */
  onTransactionPress: (transaction: Transaction) => void;
  /** Optional test ID for testing */
  testID?: string;
}

// Styled components with theme integration
const Container = styled(View)`
  margin-vertical: ${({ theme }) => theme.spacing.md}px;
  padding: ${({ theme }) => theme.spacing.sm}px;
  background-color: ${({ theme }) => theme.colors.background.primary};
  border-radius: ${({ theme }) => theme.borderRadius?.md || 8}px;
  elevation: 2;
`;

const Header = styled(View)`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
`;

const Title = styled(Text)`
  font-size: 18px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text.primary};
`;

const ErrorContainer = styled(View)`
  padding: ${({ theme }) => theme.spacing.md}px;
  align-items: center;
  justify-content: center;
`;

const ErrorText = styled(Text)`
  color: ${({ theme }) => theme.colors.status.error};
  font-size: 14px;
  text-align: center;
`;

/**
 * RecentTransactions component displays a paginated list of recent financial transactions
 * with loading states, error handling, and pull-to-refresh functionality.
 */
const RecentTransactions: React.FC<RecentTransactionsProps> = memo(({
  limit = 5,
  onTransactionPress,
  testID = 'recent-transactions'
}) => {
  const { theme } = useTheme();
  const { 
    transactions: recentTransactions,
    loading,
    error,
    fetchTransactions,
    hasMore
  } = useTransactions();

  // Initialize transactions fetch
  useEffect(() => {
    const startTime = Date.now();
    
    fetchTransactions({
      page: 1,
      limit,
      sortBy: 'date',
      sortOrder: 'desc'
    });

    // Track component load performance
    const loadTime = Date.now() - startTime;
    analytics().logEvent('recent_transactions_loaded', {
      load_time: loadTime,
      transaction_count: limit
    });

    return () => {
      // Cleanup and performance logging
      analytics().logEvent('recent_transactions_unmounted', {
        visible_duration: Date.now() - startTime
      });
    };
  }, [fetchTransactions, limit]);

  // Handle refresh functionality
  const [refreshing, setRefreshing] = React.useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchTransactions({
        page: 1,
        limit,
        sortBy: 'date',
        sortOrder: 'desc'
      });
      analytics().logEvent('recent_transactions_refreshed');
    } finally {
      setRefreshing(false);
    }
  }, [fetchTransactions, limit]);

  // Handle transaction press with analytics
  const handleTransactionPress = useCallback((transaction: Transaction) => {
    analytics().logEvent('transaction_selected', {
      transaction_id: transaction.id,
      amount: transaction.amount,
      category: transaction.category
    });
    onTransactionPress(transaction);
  }, [onTransactionPress]);

  // Render error state
  if (error) {
    return (
      <ErrorContainer testID={`${testID}-error`}>
        <ErrorText>Unable to load recent transactions</ErrorText>
        <TouchableOpacity onPress={handleRefresh}>
          <Text>Retry</Text>
        </TouchableOpacity>
      </ErrorContainer>
    );
  }

  // Render loading skeleton
  if (loading && !refreshing) {
    return (
      <Container testID={`${testID}-loading`}>
        <Header>
          <Title>Recent Transactions</Title>
        </Header>
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonLoader
            key={`skeleton-${index}`}
            height={60}
            style={{ marginVertical: 8 }}
          />
        ))}
      </Container>
    );
  }

  return (
    <ErrorBoundary
      fallback={<ErrorText>Something went wrong</ErrorText>}
      onError={(error) => {
        analytics().logEvent('recent_transactions_error', {
          error_message: error.message
        });
      }}
    >
      <Container testID={testID}>
        <Header>
          <Title accessibilityRole="header">Recent Transactions</Title>
        </Header>
        <FlatList
          data={recentTransactions.slice(0, limit)}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TransactionItem
              transaction={item}
              onPress={() => handleTransactionPress(item)}
              testID={`${testID}-item-${item.id}`}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.brand.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', padding: 16 }}>
              No recent transactions
            </Text>
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasMore && !loading) {
              fetchTransactions({
                page: Math.ceil(recentTransactions.length / limit) + 1,
                limit,
                sortBy: 'date',
                sortOrder: 'desc'
              });
            }
          }}
        />
      </Container>
    </ErrorBoundary>
  );
});

// Display name for debugging
RecentTransactions.displayName = 'RecentTransactions';

export default RecentTransactions;