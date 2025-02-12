import { useState, useEffect, useCallback } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.0
import { accountsActions, selectAccounts } from '../../store/slices/accountsSlice';
import { Account, AccountStatus } from '../../types/models';
import { PlaidLinkRequest } from '../../types/api';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

/**
 * Enhanced custom hook for managing financial accounts with comprehensive error handling
 * and performance monitoring
 * @returns {Object} Account management functions and state
 */
export const useAccounts = () => {
  // State for loading and error handling
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{
    message: string;
    code: string;
    retry?: () => Promise<void>;
  } | null>(null);

  // Redux hooks
  const dispatch = useDispatch();
  const accounts = useSelector(selectAccounts);

  // Performance monitoring state
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncInProgress, setSyncInProgress] = useState<boolean>(false);

  /**
   * Fetches all accounts with error handling and caching
   */
  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const startTime = Date.now();
      await dispatch(accountsActions.fetchAccounts()).unwrap();
      
      // Performance monitoring
      const endTime = Date.now();
      if (endTime - startTime > PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME) {
        console.warn('Account fetch exceeded performance threshold');
      }
    } catch (err) {
      const error = err as Error;
      setError({
        message: 'Failed to fetch accounts',
        code: 'FETCH_ERROR',
        retry: fetchAccounts
      });
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Links a new financial account via Plaid
   * @param linkData Plaid link request data
   */
  const linkAccount = useCallback(async (linkData: PlaidLinkRequest) => {
    try {
      setLoading(true);
      setError(null);

      await dispatch(accountsActions.linkAccount(linkData)).unwrap();
    } catch (err) {
      const error = err as Error;
      setError({
        message: 'Failed to link account',
        code: 'LINK_ERROR',
        retry: () => linkAccount(linkData)
      });
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Syncs account data with debouncing and performance monitoring
   * @param accountId ID of the account to sync
   */
  const syncAccount = useCallback(async (accountId: string) => {
    try {
      // Debounce sync requests
      if (
        syncInProgress || 
        (lastSyncTime && Date.now() - lastSyncTime < PERFORMANCE_THRESHOLDS.CACHE_TTL * 1000)
      ) {
        return;
      }

      setSyncInProgress(true);
      setError(null);

      const startTime = Date.now();
      await dispatch(accountsActions.syncAccountData(accountId)).unwrap();
      
      setLastSyncTime(Date.now());

      // Performance monitoring
      const syncDuration = Date.now() - startTime;
      if (syncDuration > PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME) {
        console.warn(`Account sync exceeded performance threshold: ${syncDuration}ms`);
      }
    } catch (err) {
      const error = err as Error;
      setError({
        message: 'Failed to sync account',
        code: 'SYNC_ERROR',
        retry: () => syncAccount(accountId)
      });
    } finally {
      setSyncInProgress(false);
    }
  }, [dispatch, syncInProgress, lastSyncTime]);

  /**
   * Removes an account with confirmation
   * @param accountId ID of the account to remove
   */
  const removeAccount = useCallback(async (accountId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Find account to check status
      const account = accounts.find(acc => acc.id === accountId);
      if (account?.status === AccountStatus.ERROR) {
        throw new Error('Cannot remove account in error state');
      }

      await dispatch(accountsActions.removeAccount(accountId)).unwrap();
    } catch (err) {
      const error = err as Error;
      setError({
        message: 'Failed to remove account',
        code: 'REMOVE_ERROR',
        retry: () => removeAccount(accountId)
      });
    } finally {
      setLoading(false);
    }
  }, [dispatch, accounts]);

  // Initial fetch on mount
  useEffect(() => {
    fetchAccounts();

    // Cleanup function to handle unmounting
    return () => {
      setSyncInProgress(false);
    };
  }, [fetchAccounts]);

  return {
    accounts,
    loading,
    error,
    fetchAccounts,
    linkAccount,
    syncAccount,
    removeAccount
  };
};