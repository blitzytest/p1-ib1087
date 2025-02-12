/**
 * Custom React hook for managing financial transactions with optimized performance,
 * enhanced error handling, and comprehensive type safety.
 * @version 1.0.0
 */

import { useSelector, useDispatch } from 'react-redux'; // ^8.0.5
import { useCallback, useRef } from 'react'; // ^18.2.0
import { Transaction } from '../../types/models';
import { TransactionFilters } from '../../types/api';
import { 
  selectAllTransactions,
  selectTransactionsByAccount,
  selectTransactionsByCategory,
  selectTransactionErrors,
  selectPendingUpdates,
  fetchTransactions as fetchTransactionsAction,
  updateCategory,
  clearErrors,
  clearCache
} from '../../store/slices/transactionsSlice';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

// Interface for hook return type
interface UseTransactionsReturn {
  transactions: Transaction[];
  loading: boolean;
  errors: Record<string, string>;
  pendingUpdates: Record<string, boolean>;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  fetchTransactions: (filters: TransactionFilters) => Promise<void>;
  fetchTransactionsByAccount: (accountId: string, filters: Partial<TransactionFilters>) => Promise<void>;
  fetchTransactionsByCategory: (category: string, filters: Partial<TransactionFilters>) => Promise<void>;
  updateTransactionCategory: (transactionId: string, category: string) => Promise<void>;
  clearTransactionErrors: () => void;
  clearTransactionCache: () => void;
}

/**
 * Custom hook for managing financial transactions with optimized performance
 * and comprehensive error handling
 */
export const useTransactions = (): UseTransactionsReturn => {
  const dispatch = useDispatch();
  
  // Request cancellation and debouncing refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Select transaction state with memoization
  const transactions = useSelector(selectAllTransactions);
  const errors = useSelector(selectTransactionErrors);
  const pendingUpdates = useSelector(selectPendingUpdates);
  const loading = useSelector((state: any) => state.transactions.loading);
  const pagination = useSelector((state: any) => state.transactions.pagination);

  /**
   * Fetches transactions with debouncing and request cancellation
   */
  const fetchTransactions = useCallback(async (filters: TransactionFilters): Promise<void> => {
    try {
      // Cancel previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Debounce requests
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      await new Promise((resolve) => {
        debounceTimerRef.current = setTimeout(async () => {
          try {
            await dispatch(fetchTransactionsAction(filters) as any);
            resolve(undefined);
          } catch (error) {
            console.error('Error fetching transactions:', error);
            resolve(undefined);
          }
        }, 300);
      });
    } catch (error) {
      console.error('Error in fetchTransactions:', error);
    }
  }, [dispatch]);

  /**
   * Fetches transactions for a specific account
   */
  const fetchTransactionsByAccount = useCallback(async (
    accountId: string,
    filters: Partial<TransactionFilters>
  ): Promise<void> => {
    const fullFilters: TransactionFilters = {
      ...filters,
      accountIds: [accountId],
      startDate: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: filters.endDate || new Date(),
      page: filters.page || 1,
      limit: filters.limit || 20
    } as TransactionFilters;

    await fetchTransactions(fullFilters);
  }, [fetchTransactions]);

  /**
   * Fetches transactions for a specific category
   */
  const fetchTransactionsByCategory = useCallback(async (
    category: string,
    filters: Partial<TransactionFilters>
  ): Promise<void> => {
    const fullFilters: TransactionFilters = {
      ...filters,
      categories: [category],
      startDate: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: filters.endDate || new Date(),
      page: filters.page || 1,
      limit: filters.limit || 20
    } as TransactionFilters;

    await fetchTransactions(fullFilters);
  }, [fetchTransactions]);

  /**
   * Updates transaction category with optimistic updates
   */
  const updateTransactionCategory = useCallback(async (
    transactionId: string,
    category: string
  ): Promise<void> => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const rollbackData = { ...transaction };
    
    try {
      await dispatch(updateCategory({ 
        transactionId, 
        category, 
        rollbackData 
      }) as any);
    } catch (error) {
      console.error('Error updating transaction category:', error);
      throw error;
    }
  }, [dispatch, transactions]);

  /**
   * Clears transaction errors
   */
  const clearTransactionErrors = useCallback((): void => {
    dispatch(clearErrors());
  }, [dispatch]);

  /**
   * Clears transaction cache
   */
  const clearTransactionCache = useCallback((): void => {
    dispatch(clearCache());
  }, [dispatch]);

  return {
    transactions,
    loading,
    errors,
    pendingUpdates,
    pagination,
    fetchTransactions,
    fetchTransactionsByAccount,
    fetchTransactionsByCategory,
    updateTransactionCategory,
    clearTransactionErrors,
    clearTransactionCache
  };
};

export default useTransactions;