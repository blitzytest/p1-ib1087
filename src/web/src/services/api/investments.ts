/**
 * Investment API service module for the Mint Clone application
 * Handles investment portfolio monitoring, performance tracking, and allocation analysis
 * @version 1.0.0
 */

import api from '../../config/api';
import { ApiResponse } from '../../types/api';
import { AxiosResponse } from 'axios'; // ^1.4.0
import { 
  Investment,
  PerformanceMetrics,
  AssetAllocation,
  TimeRange,
  InvestmentFilters,
  AggregationType
} from '../../types/models';
import { API_ENDPOINTS } from '../../config/api';

/**
 * Retrieves investment holdings with detailed portfolio metrics
 * @param filters - Investment filtering parameters
 * @returns Promise resolving to list of investment holdings with metrics
 */
export const getInvestments = async (
  filters: InvestmentFilters
): Promise<ApiResponse<Investment[]>> => {
  try {
    const response: AxiosResponse<ApiResponse<Investment[]>> = await api.get(
      API_ENDPOINTS.INVESTMENTS.HOLDINGS,
      {
        params: {
          portfolioId: filters.portfolioId,
          assetTypes: filters.assetType,
          timeRange: filters.timeRange,
          includeHistory: filters.includeHistory,
          aggregationType: filters.aggregationType
        }
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Interface for portfolio performance response
 */
interface PerformanceResponse {
  returns: {
    daily: number;
    weekly: number;
    monthly: number;
    quarterly: number;
    yearly: number;
    ytd: number;
  };
  risk: {
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  benchmarks: {
    sp500: number;
    nasdaq: number;
    dowJones: number;
  };
}

/**
 * Retrieves detailed portfolio performance metrics with historical analysis
 * @param portfolioId - Unique identifier for the investment portfolio
 * @param timeRange - Time period for performance analysis
 * @returns Promise resolving to comprehensive performance metrics
 */
export const getPortfolioPerformance = async (
  portfolioId: string,
  timeRange: TimeRange
): Promise<ApiResponse<PerformanceMetrics>> => {
  try {
    const response: AxiosResponse<ApiResponse<PerformanceResponse>> = await api.get(
      API_ENDPOINTS.INVESTMENTS.PERFORMANCE,
      {
        params: {
          portfolioId,
          timeRange
        }
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Interface for asset allocation response
 */
interface AssetAllocation {
  assetClasses: {
    [key: string]: {
      percentage: number;
      value: number;
      risk: number;
    };
  };
  sectors: {
    [key: string]: {
      percentage: number;
      value: number;
      risk: number;
    };
  };
  geography: {
    [key: string]: {
      percentage: number;
      value: number;
      risk: number;
    };
  };
  riskMetrics: {
    diversificationScore: number;
    concentrationRisk: number;
    correlationMatrix: Record<string, number>;
  };
}

/**
 * Retrieves detailed asset allocation breakdown with risk analysis
 * @param portfolioId - Unique identifier for the investment portfolio
 * @returns Promise resolving to detailed allocation data with risk metrics
 */
export const getAssetAllocation = async (
  portfolioId: string
): Promise<ApiResponse<AssetAllocation>> => {
  try {
    const response: AxiosResponse<ApiResponse<AssetAllocation>> = await api.get(
      API_ENDPOINTS.INVESTMENTS.PORTFOLIO,
      {
        params: {
          portfolioId
        }
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Retrieves investment performance history for charting
 * @param portfolioId - Unique identifier for the investment portfolio
 * @param timeRange - Time period for historical data
 * @param aggregationType - Data aggregation granularity
 * @returns Promise resolving to historical performance data
 */
export const getInvestmentHistory = async (
  portfolioId: string,
  timeRange: TimeRange,
  aggregationType: AggregationType
): Promise<ApiResponse<Array<{ date: string; value: number }>>> => {
  try {
    const response: AxiosResponse<ApiResponse<Array<{ date: string; value: number }>>> = await api.get(
      `${API_ENDPOINTS.INVESTMENTS.PORTFOLIO}/history`,
      {
        params: {
          portfolioId,
          timeRange,
          aggregationType
        }
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

export type { 
  AssetAllocation,
  PerformanceResponse
};