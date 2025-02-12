/**
 * API service module for financial account operations
 * Implements account linking, syncing, and management through Plaid integration
 * @version 1.0.0
 */

import api, { API_ENDPOINTS } from '../../config/api';
import { Account } from '../../types/models';
import { ApiResponse, PlaidLinkRequest } from '../../types/api';
import { cache } from 'axios-cache-adapter'; // ^2.7.3
import { retry } from 'axios-retry'; // ^3.5.0
import { AxiosResponse } from 'axios'; // ^1.4.0

// Cache configuration for account data
const accountsCache = cache.setupCache({
  maxAge: 5 * 60 * 1000, // 5 minutes
  exclude: { query: false }
});

// Retry configuration for account operations
retry(api, {
  retries: 3,
  retryDelay: retry.exponentialDelay,
  retryCondition: (error) => {
    return retry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
  }
});

/**
 * Retrieves all financial accounts for the authenticated user
 * Implements caching with automatic invalidation
 * @returns Promise<ApiResponse<Account[]>> List of user's financial accounts
 */
export const getAccounts = async (): Promise<ApiResponse<Account[]>> => {
  try {
    const response: AxiosResponse<ApiResponse<Account[]>> = await api.get(
      API_ENDPOINTS.ACCOUNTS.LIST,
      { cache: accountsCache }
    );

    return response.data;
  } catch (error) {
    return {
      success: false,
      data: [],
      error: {
        code: 'ACCOUNTS_FETCH_ERROR',
        message: 'Failed to fetch accounts',
        details: { originalError: error }
      },
      timestamp: new Date(),
      version: '1.0.0'
    };
  }
};

/**
 * Links a new financial institution account via Plaid
 * @param request PlaidLinkRequest containing public token and account metadata
 * @returns Promise<ApiResponse<Account>> Newly linked account details
 */
export const linkPlaidAccount = async (
  request: PlaidLinkRequest
): Promise<ApiResponse<Account>> => {
  try {
    const response: AxiosResponse<ApiResponse<Account>> = await api.post(
      API_ENDPOINTS.ACCOUNTS.LINK,
      request
    );

    // Invalidate accounts cache after successful linking
    accountsCache.clear();

    return response.data;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'ACCOUNT_LINK_ERROR',
        message: 'Failed to link account',
        details: { originalError: error }
      },
      timestamp: new Date(),
      version: '1.0.0'
    };
  }
};

/**
 * Creates a new manual account with validation
 * @param accountDetails Details for the manual account creation
 * @returns Promise<ApiResponse<Account>> Created manual account details
 */
export const createManualAccount = async (
  accountDetails: Omit<Account, 'id' | 'userId' | 'plaidAccountId' | 'lastSync'>
): Promise<ApiResponse<Account>> => {
  try {
    const response: AxiosResponse<ApiResponse<Account>> = await api.post(
      `${API_ENDPOINTS.ACCOUNTS.LIST}/manual`,
      accountDetails
    );

    // Invalidate accounts cache after creating new account
    accountsCache.clear();

    return response.data;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'MANUAL_ACCOUNT_CREATE_ERROR',
        message: 'Failed to create manual account',
        details: { originalError: error }
      },
      timestamp: new Date(),
      version: '1.0.0'
    };
  }
};

/**
 * Triggers a sync operation for a specific account with progress tracking
 * @param accountId ID of the account to sync
 * @returns Promise<ApiResponse<Account>> Updated account details with sync status
 */
export const syncAccount = async (accountId: string): Promise<ApiResponse<Account>> => {
  try {
    const response: AxiosResponse<ApiResponse<Account>> = await api.post(
      `${API_ENDPOINTS.ACCOUNTS.SYNC}/${accountId}`
    );

    // Invalidate specific account in cache
    accountsCache.delete(`${API_ENDPOINTS.ACCOUNTS.LIST}/${accountId}`);

    return response.data;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'ACCOUNT_SYNC_ERROR',
        message: 'Failed to sync account',
        details: { originalError: error }
      },
      timestamp: new Date(),
      version: '1.0.0'
    };
  }
};

/**
 * Updates an existing account's details
 * @param accountId ID of the account to update
 * @param updates Partial account details to update
 * @returns Promise<ApiResponse<Account>> Updated account details
 */
export const updateAccount = async (
  accountId: string,
  updates: Partial<Account>
): Promise<ApiResponse<Account>> => {
  try {
    const response: AxiosResponse<ApiResponse<Account>> = await api.put(
      `${API_ENDPOINTS.ACCOUNTS.LIST}/${accountId}`,
      updates
    );

    // Invalidate specific account in cache
    accountsCache.delete(`${API_ENDPOINTS.ACCOUNTS.LIST}/${accountId}`);

    return response.data;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'ACCOUNT_UPDATE_ERROR',
        message: 'Failed to update account',
        details: { originalError: error }
      },
      timestamp: new Date(),
      version: '1.0.0'
    };
  }
};

/**
 * Removes an account from the system
 * @param accountId ID of the account to remove
 * @returns Promise<ApiResponse<void>> Confirmation of account removal
 */
export const removeAccount = async (accountId: string): Promise<ApiResponse<void>> => {
  try {
    const response: AxiosResponse<ApiResponse<void>> = await api.delete(
      `${API_ENDPOINTS.ACCOUNTS.LIST}/${accountId}`
    );

    // Clear entire accounts cache as totals may be affected
    accountsCache.clear();

    return response.data;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'ACCOUNT_REMOVE_ERROR',
        message: 'Failed to remove account',
        details: { originalError: error }
      },
      timestamp: new Date(),
      version: '1.0.0'
    };
  }
};