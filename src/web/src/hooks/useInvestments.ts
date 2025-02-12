import { useEffect, useCallback } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.0
import { Investment } from '../../types/models';
import {
  selectInvestments,
  selectPerformance,
  selectAllocation,
  selectInvestmentLoadingStates,
  selectInvestmentErrors,
  selectLastSync,
  selectIsStale,
  fetchInvestments,
  fetchPortfolioPerformance,
  fetchAssetAllocation,
  clearInvestmentErrors
} from '../../store/slices/investmentsSlice';
import { TimeRange, InvestmentFilters } from '../../types/api';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

interface UseInvestmentsOptions {
  refreshInterval?: number;
  autoRefresh?: boolean;
  includeHistory?: boolean;
}

/**
 * Custom hook for managing investment portfolio data and operations
 * @param portfolioId - Unique identifier for the investment portfolio
 * @param options - Configuration options for the hook
 */
export const useInvestments = (
  portfolioId: string,
  options: UseInvestmentsOptions = {}
) => {
  const {
    refreshInterval = PERFORMANCE_THRESHOLDS.STALE_DATA_THRESHOLD * 1000,
    autoRefresh = true,
    includeHistory = false
  } = options;

  const dispatch = useDispatch();

  // Redux selectors
  const investments = useSelector(selectInvestments);
  const performance = useSelector(selectPerformance);
  const allocation = useSelector(selectAllocation);
  const loadingStates = useSelector(selectInvestmentLoadingStates);
  const errors = useSelector(selectInvestmentErrors);
  const lastSync = useSelector(selectLastSync);
  const isStale = useSelector(selectIsStale);

  /**
   * Fetches complete portfolio data including holdings, performance, and allocation
   */
  const refreshPortfolio = useCallback(async () => {
    if (!portfolioId) return;

    try {
      // Clear any existing errors
      dispatch(clearInvestmentErrors());

      // Prepare filters for investment data
      const filters: InvestmentFilters = {
        portfolioId,
        assetType: [],
        timeRange: TimeRange.YTD,
        includeHistory,
        aggregationType: 'daily'
      };

      // Fetch all portfolio data concurrently
      await Promise.all([
        dispatch(fetchInvestments(filters)),
        dispatch(fetchPortfolioPerformance({ 
          portfolioId, 
          timeRange: TimeRange.YTD 
        })),
        dispatch(fetchAssetAllocation(portfolioId))
      ]);
    } catch (error) {
      console.error('Failed to refresh portfolio:', error);
    }
  }, [portfolioId, dispatch, includeHistory]);

  /**
   * Fetches performance metrics for a specific time period
   */
  const fetchPerformance = useCallback(async (
    timeRange: TimeRange
  ) => {
    if (!portfolioId) return;

    try {
      await dispatch(fetchPortfolioPerformance({ portfolioId, timeRange }));
    } catch (error) {
      console.error('Failed to fetch performance:', error);
    }
  }, [portfolioId, dispatch]);

  // Initial data fetch and auto-refresh setup
  useEffect(() => {
    // Fetch initial data
    refreshPortfolio();

    // Set up auto-refresh interval if enabled
    let refreshTimer: NodeJS.Timeout;
    if (autoRefresh) {
      refreshTimer = setInterval(() => {
        if (isStale) {
          refreshPortfolio();
        }
      }, refreshInterval);
    }

    // Cleanup on unmount
    return () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    };
  }, [refreshPortfolio, autoRefresh, refreshInterval, isStale]);

  return {
    // Portfolio data
    investments,
    performance,
    allocation,
    lastSync,
    
    // Loading and error states
    isLoading: Object.values(loadingStates).some(state => state),
    errors,
    isStale,
    
    // Management functions
    refreshPortfolio,
    fetchPerformance,
    
    // Individual loading states
    loadingStates: {
      holdings: loadingStates.holdings,
      performance: loadingStates.performance,
      allocation: loadingStates.allocation
    }
  };
};

export type { UseInvestmentsOptions };