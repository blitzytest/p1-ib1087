/**
 * Enhanced custom React hook for managing budgets with real-time updates and alerts
 * Provides comprehensive budget management functionality including CRUD operations,
 * progress tracking, and alert monitoring
 * @version 1.0.0
 */

import { useSelector, useDispatch } from 'react-redux'; // ^8.0.5
import { useCallback } from 'react'; // ^18.2.0
import { useWebSocket } from 'react-use-websocket'; // ^3.0.0

import { Budget } from '../../types/models';
import {
  selectBudgets,
  selectBudgetById,
  budgetsSlice,
  selectBudgetWithProgress,
  selectBudgetAlertState,
  selectNotificationPreferences,
  fetchBudgets,
  updateBudgetProgress,
  updateNotificationPreferences
} from '../../store/slices/budgetsSlice';

// WebSocket endpoint for real-time updates
const WEBSOCKET_ENDPOINT = process.env.REACT_APP_WS_ENDPOINT || 'ws://localhost:8080/budgets';

/**
 * Enhanced budget progress interface with trend analysis
 */
interface BudgetProgress {
  spent: number;
  remaining: number;
  percentage: number;
  trend: {
    direction: 'up' | 'down' | 'stable';
    rate: number;
  };
}

/**
 * Alert preferences configuration interface
 */
interface AlertPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  threshold: number;
}

/**
 * Enhanced custom hook for comprehensive budget management
 * @returns Object containing budget state and management functions
 */
export const useBudgets = () => {
  const dispatch = useDispatch();
  
  // WebSocket connection for real-time updates
  const { sendMessage, lastMessage, readyState } = useWebSocket(WEBSOCKET_ENDPOINT, {
    shouldReconnect: () => true,
    reconnectInterval: 3000,
    reconnectAttempts: 10
  });

  // Select budgets from Redux store with memoization
  const budgets = useSelector(selectBudgets);
  const loading = useSelector((state: any) => state.budgets.loading);
  const error = useSelector((state: any) => state.budgets.error);

  /**
   * Fetch all budgets with enhanced error handling
   */
  const fetchAllBudgets = useCallback(async () => {
    try {
      await dispatch(fetchBudgets());
    } catch (error) {
      console.error('Failed to fetch budgets:', error);
    }
  }, [dispatch]);

  /**
   * Create new budget with enhanced validation
   */
  const createBudget = useCallback(async (budgetData: Omit<Budget, 'id'>) => {
    try {
      const action = budgetsSlice.actions.addBudget(budgetData);
      await dispatch(action);
      // Notify WebSocket of new budget
      sendMessage(JSON.stringify({ type: 'BUDGET_CREATED', payload: budgetData }));
      return true;
    } catch (error) {
      console.error('Failed to create budget:', error);
      return false;
    }
  }, [dispatch, sendMessage]);

  /**
   * Update existing budget with real-time sync
   */
  const updateBudget = useCallback(async (budgetId: string, updates: Partial<Budget>) => {
    try {
      const action = budgetsSlice.actions.updateBudget({ id: budgetId, updates });
      await dispatch(action);
      // Notify WebSocket of budget update
      sendMessage(JSON.stringify({ type: 'BUDGET_UPDATED', payload: { id: budgetId, updates } }));
      return true;
    } catch (error) {
      console.error('Failed to update budget:', error);
      return false;
    }
  }, [dispatch, sendMessage]);

  /**
   * Delete budget with cleanup
   */
  const deleteBudget = useCallback(async (budgetId: string) => {
    try {
      const action = budgetsSlice.actions.deleteBudget(budgetId);
      await dispatch(action);
      // Notify WebSocket of budget deletion
      sendMessage(JSON.stringify({ type: 'BUDGET_DELETED', payload: { id: budgetId } }));
      return true;
    } catch (error) {
      console.error('Failed to delete budget:', error);
      return false;
    }
  }, [dispatch, sendMessage]);

  /**
   * Get real-time budget progress with trend analysis
   */
  const getBudgetProgress = useCallback(async (budgetId: string): Promise<BudgetProgress> => {
    try {
      const budget = useSelector((state: any) => selectBudgetWithProgress(state, budgetId));
      if (!budget) throw new Error('Budget not found');

      const progress = await dispatch(updateBudgetProgress(budgetId));
      return progress.payload as BudgetProgress;
    } catch (error) {
      console.error('Failed to get budget progress:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Update alert preferences with enhanced validation
   */
  const updateAlertPreferences = useCallback(async (
    budgetId: string,
    preferences: AlertPreferences
  ) => {
    try {
      if (preferences.threshold < 0 || preferences.threshold > 100) {
        throw new Error('Alert threshold must be between 0 and 100');
      }

      await dispatch(updateNotificationPreferences({
        budgetId,
        preferences: {
          email: preferences.email,
          push: preferences.push,
          sms: preferences.sms
        }
      }));

      await updateBudget(budgetId, { alertThreshold: preferences.threshold });
      return true;
    } catch (error) {
      console.error('Failed to update alert preferences:', error);
      return false;
    }
  }, [dispatch, updateBudget]);

  /**
   * Handle real-time WebSocket updates
   */
  useCallback(() => {
    if (lastMessage) {
      const update = JSON.parse(lastMessage.data);
      switch (update.type) {
        case 'BUDGET_PROGRESS_UPDATE':
          dispatch(updateBudgetProgress(update.payload.budgetId));
          break;
        case 'BUDGET_ALERT_TRIGGERED':
          const alertState = useSelector((state: any) => 
            selectBudgetAlertState(state, update.payload.budgetId)
          );
          if (alertState?.triggered) {
            // Handle alert notification
            console.log('Budget alert triggered:', update.payload);
          }
          break;
      }
    }
  }, [lastMessage, dispatch]);

  return {
    budgets,
    loading,
    error,
    fetchBudgets: fetchAllBudgets,
    createBudget,
    updateBudget,
    deleteBudget,
    getBudgetProgress,
    updateAlertPreferences,
    realTimeStatus: readyState
  };
};