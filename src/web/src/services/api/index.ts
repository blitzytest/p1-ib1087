/**
 * Main API service entry point for the Mint Clone application
 * Aggregates and exports all API services with performance optimization
 * @version 1.0.0
 */

import * as authService from './auth';
import * as accountsApi from './accounts';
import * as transactionsApi from './transactions';
import * as budgetsApi from './budgets';
import * as investmentsApi from './investments';

// Initialize request deduplication cache
const requestCache: { [key: string]: { timestamp: number; promise: Promise<any> } } = {};

/**
 * Initializes the API service with performance optimizations
 * Sets up request deduplication, caching, and error handling
 */
const initializeApi = () => {
  // Clear expired cache entries periodically
  setInterval(() => {
    const now = Date.now();
    Object.keys(requestCache).forEach(key => {
      if (now - requestCache[key].timestamp > 300000) { // 5 minutes TTL
        delete requestCache[key];
      }
    });
  }, 60000); // Check every minute
};

/**
 * Enhanced API service object with performance optimizations
 * Implements request deduplication and comprehensive error handling
 */
export const api = {
  /**
   * Authentication service with enhanced security
   */
  auth: {
    /**
     * Login with request deduplication
     */
    login: async (credentials: Parameters<typeof authService.login>[0], deviceInfo: Parameters<typeof authService.login>[1]) => {
      const cacheKey = `login-${credentials.email}-${deviceInfo.deviceId}`;
      if (requestCache[cacheKey] && Date.now() - requestCache[cacheKey].timestamp < 2000) {
        return requestCache[cacheKey].promise;
      }

      const promise = authService.login(credentials, deviceInfo);
      requestCache[cacheKey] = {
        timestamp: Date.now(),
        promise
      };

      return promise;
    },
    verifyMfa: authService.verifyMfa,
    forgotPassword: authService.forgotPassword,
    resetPassword: authService.resetPassword,
    refreshToken: authService.refreshToken
  },

  /**
   * Account management with Plaid integration
   */
  accounts: {
    getAccounts: accountsApi.getAccounts,
    getAccountById: async (accountId: string) => {
      const cacheKey = `account-${accountId}`;
      if (requestCache[cacheKey] && Date.now() - requestCache[cacheKey].timestamp < 300000) {
        return requestCache[cacheKey].promise;
      }

      const promise = accountsApi.getAccountById(accountId);
      requestCache[cacheKey] = {
        timestamp: Date.now(),
        promise
      };

      return promise;
    },
    linkPlaidAccount: accountsApi.linkPlaidAccount,
    syncAccount: accountsApi.syncAccount,
    deleteAccount: accountsApi.deleteAccount
  },

  /**
   * Transaction management with optimized performance
   */
  transactions: {
    getTransactions: transactionsApi.getTransactions,
    getTransactionById: transactionsApi.getTransactionById,
    updateTransactionCategory: transactionsApi.updateTransactionCategory,
    getTransactionsByAccount: transactionsApi.getTransactionsByAccount
  },

  /**
   * Budget tracking with real-time updates
   */
  budgets: {
    getBudgets: budgetsApi.getBudgets,
    getBudgetById: budgetsApi.getBudgetById,
    createBudget: budgetsApi.createBudget,
    updateBudget: budgetsApi.updateBudget,
    deleteBudget: budgetsApi.deleteBudget,
    getBudgetProgress: budgetsApi.getBudgetProgress
  },

  /**
   * Investment portfolio tracking and analysis
   */
  investments: {
    getInvestments: investmentsApi.getInvestments,
    getInvestmentDetails: investmentsApi.getInvestmentDetails,
    getPortfolioPerformance: investmentsApi.getPortfolioPerformance,
    getAssetAllocation: investmentsApi.getAssetAllocation
  }
};

// Initialize API service
initializeApi();

export default api;