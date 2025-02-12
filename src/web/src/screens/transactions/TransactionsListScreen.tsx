import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import TransactionItem from '../../components/transactions/TransactionItem';
import TransactionFilters from '../../components/transactions/TransactionFilters';
import useTransactions from '../../hooks/useTransactions';
import { useTheme } from '../../hooks/useTheme';
import { Transaction } from '../../types/models';
import { TransactionFilters as TransactionFiltersType } from '../../types/api';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

// Interface for route params
interface TransactionListScreenProps {
  route: {
    params: {
      accountId?: string;
      initialFilters?: TransactionFiltersType;
    };
  };
}

/**
 * TransactionsListScreen component displays a paginated, filterable list of financial transactions
 * with optimized performance and real-time updates.
 */
const TransactionsListScreen: React.FC<TransactionListScreenProps> = ({ route }) => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Extract route params
  const { accountId, initialFilters } = route.params || {};

  // Local state management
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<TransactionFiltersType>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    categories: [],
    accountIds: accountId ? [accountId] : [],
    page: 1,
    limit: 20,
    sortBy: 'date',
    sortOrder: 'desc',
    minAmount: 0,
    maxAmount: Number.MAX_SAFE_INTEGER
  });

  // Custom hook for transaction management
  const {
    transactions,
    loading,
    errors,
    pagination,
    fetchTransactions,
    fetchTransactionsByAccount,
    clearTransactionErrors
  } = useTransactions();

  // Memoized transaction data for optimized rendering
  const transactionData = useMemo(() => transactions, [transactions]);

  /**
   * Handles filter changes with debouncing and validation
   */
  const handleFilterChange = useCallback((newFilters: TransactionFiltersType) => {
    setCurrentPage(1);
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1
    }));
  }, []);

  /**
   * Handles pull-to-refresh functionality
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (accountId) {
        await fetchTransactionsByAccount(accountId, { ...filters, page: 1 });
      } else {
        await fetchTransactions({ ...filters, page: 1 });
      }
    } finally {
      setRefreshing(false);
    }
  }, [accountId, filters, fetchTransactions, fetchTransactionsByAccount]);

  /**
   * Handles infinite scroll pagination
   */
  const handleLoadMore = useCallback(() => {
    if (!loading && currentPage < pagination.totalPages) {
      setCurrentPage(prev => prev + 1);
      const newFilters = { ...filters, page: currentPage + 1 };
      if (accountId) {
        fetchTransactionsByAccount(accountId, newFilters);
      } else {
        fetchTransactions(newFilters);
      }
    }
  }, [loading, currentPage, pagination.totalPages, filters, accountId, fetchTransactions, fetchTransactionsByAccount]);

  /**
   * Handles transaction item press with navigation
   */
  const handleTransactionPress = useCallback((transaction: Transaction) => {
    navigation.navigate('TransactionDetail', { transactionId: transaction.id });
  }, [navigation]);

  /**
   * Memoized render item function for optimized list performance
   */
  const renderItem = useCallback(({ item }: { item: Transaction }) => (
    <TransactionItem
      transaction={item}
      onPress={() => handleTransactionPress(item)}
      testID={`transaction-item-${item.id}`}
    />
  ), [handleTransactionPress]);

  /**
   * Initial data fetch
   */
  useEffect(() => {
    const fetchInitialData = async () => {
      if (accountId) {
        await fetchTransactionsByAccount(accountId, filters);
      } else {
        await fetchTransactions(filters);
      }
    };
    fetchInitialData();

    return () => {
      clearTransactionErrors();
    };
  }, [accountId, filters, fetchTransactions, fetchTransactionsByAccount, clearTransactionErrors]);

  /**
   * Performance monitoring for render times
   */
  useEffect(() => {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      if (duration > PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME) {
        console.warn('Transaction list render time exceeded threshold:', duration);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <TransactionFilters
        onFiltersChange={handleFilterChange}
        initialFilters={initialFilters}
        isLoading={loading}
      />

      {errors.fetch && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errors.fetch}</Text>
        </View>
      )}

      <FlatList
        data={transactionData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.brand.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loading && !refreshing ? (
          <ActivityIndicator
            color={theme.colors.brand.primary}
            style={styles.loader}
          />
        ) : null}
        ListEmptyComponent={!loading && (
          <Text style={styles.emptyText}>No transactions found</Text>
        )}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        testID="transactions-list"
      />
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  errorContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.status.errorLight,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    borderRadius: 8,
  },
  errorText: {
    color: theme.colors.status.error,
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
  },
  loader: {
    padding: theme.spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    padding: theme.spacing.xl,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.md,
  },
});

export default TransactionsListScreen;