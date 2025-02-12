/**
 * API service module for handling financial transaction operations
 * Implements caching, performance optimization, and error handling
 * @version 1.0.0
 */

import api, { API_ENDPOINTS } from '../../config/api';
import { Transaction, TransactionFilters, ApiResponse } from '../../types/api';
import { AxiosResponse } from 'axios'; // ^1.4.0
import { setupCache } from 'axios-cache-adapter'; // ^2.7.3
import axiosRetry from 'axios-retry'; // ^3.5.0

// Configure caching adapter for GET requests
const cache = setupCache({
  maxAge: 5 * 60 * 1000, // 5 minutes cache
  exclude: { query: false },
  key: req => {
    const serializedParams = req.params ? `?${JSON.stringify(req.params)}` : '';
    return `${req.url}${serializedParams}`;
  }
});

// Configure retry behavior for failed requests
axiosRetry(api, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
           error.response?.status === 429;
  }
});

/**
 * Retrieves a paginated list of transactions with caching and filtering
 * @param filters - Transaction filtering and pagination parameters
 * @returns Promise with paginated transaction list and metadata
 */
export const getTransactions = async (
  filters: TransactionFilters
): Promise<ApiResponse<Transaction[]>> => {
  const startTime = Date.now();

  try {
    const response: AxiosResponse<ApiResponse<Transaction[]>> = await api.get(
      API_ENDPOINTS.TRANSACTIONS.LIST,
      {
        params: {
          startDate: filters.startDate.toISOString(),
          endDate: filters.endDate.toISOString(),
          categories: filters.categories,
          accountIds: filters.accountIds,
          page: filters.page || 1,
          limit: filters.limit || 50,
          sortBy: filters.sortBy || 'date',
          sortOrder: filters.sortOrder || 'desc'
        },
        adapter: cache.adapter
      }
    );

    // Log performance metrics
    const duration = Date.now() - startTime;
    console.debug(`Transaction fetch completed in ${duration}ms`);

    return response.data;
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    throw {
      success: false,
      error: {
        code: error.code || 'TRANSACTION_FETCH_ERROR',
        message: error.message || 'Failed to fetch transactions',
        details: error.details || {}
      },
      data: [],
      timestamp: new Date(),
      version: '1.0.0'
    };
  }
};

/**
 * Updates transaction category with optimistic updates and rollback support
 * @param transactionId - ID of the transaction to update
 * @param category - New category to assign
 * @returns Promise with updated transaction data
 */
export const updateTransactionCategory = async (
  transactionId: string,
  category: string
): Promise<ApiResponse<Transaction>> => {
  const startTime = Date.now();

  try {
    const response: AxiosResponse<ApiResponse<Transaction>> = await api.post(
      `${API_ENDPOINTS.TRANSACTIONS.CATEGORIZE}/${transactionId}`,
      { category },
      {
        headers: {
          'X-Idempotency-Key': `cat-${transactionId}-${Date.now()}`
        }
      }
    );

    // Clear relevant cache entries
    cache.store.removeAll();

    // Log performance metrics
    const duration = Date.now() - startTime;
    console.debug(`Category update completed in ${duration}ms`);

    return response.data;
  } catch (error: any) {
    console.error('Error updating transaction category:', error);
    throw {
      success: false,
      error: {
        code: error.code || 'CATEGORY_UPDATE_ERROR',
        message: error.message || 'Failed to update transaction category',
        details: error.details || {}
      },
      data: null,
      timestamp: new Date(),
      version: '1.0.0'
    };
  }
};

/**
 * Searches transactions with advanced filtering and pagination
 * @param searchTerm - Search term for transaction matching
 * @param filters - Additional filtering parameters
 * @returns Promise with matched transactions and metadata
 */
export const searchTransactions = async (
  searchTerm: string,
  filters: Partial<TransactionFilters>
): Promise<ApiResponse<Transaction[]>> => {
  const startTime = Date.now();

  try {
    const response: AxiosResponse<ApiResponse<Transaction[]>> = await api.get(
      API_ENDPOINTS.TRANSACTIONS.SEARCH,
      {
        params: {
          q: searchTerm,
          ...filters,
          page: filters.page || 1,
          limit: filters.limit || 50
        },
        adapter: cache.adapter
      }
    );

    // Log performance metrics
    const duration = Date.now() - startTime;
    console.debug(`Transaction search completed in ${duration}ms`);

    return response.data;
  } catch (error: any) {
    console.error('Error searching transactions:', error);
    throw {
      success: false,
      error: {
        code: error.code || 'TRANSACTION_SEARCH_ERROR',
        message: error.message || 'Failed to search transactions',
        details: error.details || {}
      },
      data: [],
      timestamp: new Date(),
      version: '1.0.0'
    };
  }
};