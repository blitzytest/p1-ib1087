/**
 * Budget management API service module
 * Provides comprehensive budget operations with enhanced tracking and alerts
 * @version 1.0.0
 */

import axios from 'axios'; // ^1.4.0
import { Budget } from '../../types/models';
import { ApiResponse, BudgetRequest } from '../../types/api';

// Cache configuration for budget data
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let budgetsCache: { data: Budget[]; timestamp: number } | null = null;

/**
 * Budget API service object with enhanced functionality
 */
export const budgetsApi = {
  /**
   * Retrieves all budgets for the authenticated user with caching
   */
  async getBudgets(): Promise<ApiResponse<Budget[]>> {
    try {
      // Check cache validity
      if (
        budgetsCache &&
        Date.now() - budgetsCache.timestamp < CACHE_DURATION
      ) {
        return {
          success: true,
          data: budgetsCache.data,
          error: null,
          timestamp: new Date(),
          version: '1.0.0'
        };
      }

      const response = await axios.get<ApiResponse<Budget[]>>('/api/budgets');
      
      // Update cache
      budgetsCache = {
        data: response.data.data,
        timestamp: Date.now()
      };

      return response.data;
    } catch (error) {
      return {
        success: false,
        data: [],
        error: {
          code: 'BUDGET_FETCH_ERROR',
          message: 'Failed to fetch budgets',
          details: { error }
        },
        timestamp: new Date(),
        version: '1.0.0'
      };
    }
  },

  /**
   * Retrieves a specific budget by ID with real-time updates
   */
  async getBudgetById(budgetId: string): Promise<ApiResponse<Budget>> {
    try {
      if (!budgetId.match(/^[0-9a-fA-F]{24}$/)) {
        throw new Error('Invalid budget ID format');
      }

      const response = await axios.get<ApiResponse<Budget>>(
        `/api/budgets/${budgetId}`
      );

      return response.data;
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: {
          code: 'BUDGET_FETCH_ERROR',
          message: `Failed to fetch budget: ${budgetId}`,
          details: { error }
        },
        timestamp: new Date(),
        version: '1.0.0'
      };
    }
  },

  /**
   * Creates a new budget with enhanced validation and alert configuration
   */
  async createBudget(budgetData: BudgetRequest): Promise<ApiResponse<Budget>> {
    try {
      // Validate budget data
      if (!budgetData.category || !budgetData.amount) {
        throw new Error('Category and amount are required');
      }

      if (
        budgetData.alertThreshold &&
        (budgetData.alertThreshold < 0 || budgetData.alertThreshold > 100)
      ) {
        throw new Error('Alert threshold must be between 0 and 100');
      }

      const response = await axios.post<ApiResponse<Budget>>(
        '/api/budgets',
        budgetData
      );

      // Invalidate cache on creation
      budgetsCache = null;

      return response.data;
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: {
          code: 'BUDGET_CREATE_ERROR',
          message: 'Failed to create budget',
          details: { error }
        },
        timestamp: new Date(),
        version: '1.0.0'
      };
    }
  },

  /**
   * Updates an existing budget with partial update support
   */
  async updateBudget(
    budgetId: string,
    budgetData: Partial<BudgetRequest>
  ): Promise<ApiResponse<Budget>> {
    try {
      if (!budgetId.match(/^[0-9a-fA-F]{24}$/)) {
        throw new Error('Invalid budget ID format');
      }

      // Validate alert threshold if provided
      if (
        budgetData.alertThreshold !== undefined &&
        (budgetData.alertThreshold < 0 || budgetData.alertThreshold > 100)
      ) {
        throw new Error('Alert threshold must be between 0 and 100');
      }

      const response = await axios.put<ApiResponse<Budget>>(
        `/api/budgets/${budgetId}`,
        budgetData
      );

      // Invalidate cache on update
      budgetsCache = null;

      return response.data;
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: {
          code: 'BUDGET_UPDATE_ERROR',
          message: `Failed to update budget: ${budgetId}`,
          details: { error }
        },
        timestamp: new Date(),
        version: '1.0.0'
      };
    }
  },

  /**
   * Deletes an existing budget with cleanup
   */
  async deleteBudget(budgetId: string): Promise<ApiResponse<void>> {
    try {
      if (!budgetId.match(/^[0-9a-fA-F]{24}$/)) {
        throw new Error('Invalid budget ID format');
      }

      const response = await axios.delete<ApiResponse<void>>(
        `/api/budgets/${budgetId}`
      );

      // Invalidate cache on deletion
      budgetsCache = null;

      return response.data;
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: {
          code: 'BUDGET_DELETE_ERROR',
          message: `Failed to delete budget: ${budgetId}`,
          details: { error }
        },
        timestamp: new Date(),
        version: '1.0.0'
      };
    }
  },

  /**
   * Retrieves enhanced budget progress with trend analysis
   */
  async getBudgetProgress(
    budgetId: string
  ): Promise<
    ApiResponse<{
      spent: number;
      remaining: number;
      percentage: number;
      trend: {
        direction: 'up' | 'down' | 'stable';
        rate: number;
      };
    }>
  > {
    try {
      if (!budgetId.match(/^[0-9a-fA-F]{24}$/)) {
        throw new Error('Invalid budget ID format');
      }

      const response = await axios.get<
        ApiResponse<{
          spent: number;
          remaining: number;
          percentage: number;
          trend: {
            direction: 'up' | 'down' | 'stable';
            rate: number;
          };
        }>
      >(`/api/budgets/${budgetId}/progress`);

      return response.data;
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: {
          code: 'BUDGET_PROGRESS_ERROR',
          message: `Failed to fetch budget progress: ${budgetId}`,
          details: { error }
        },
        timestamp: new Date(),
        version: '1.0.0'
      };
    }
  }
};