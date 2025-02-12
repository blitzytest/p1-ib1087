/**
 * Redux slice for managing budget state with real-time updates and alerts
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'; // ^1.9.0
import { Budget } from '../../types/models';
import { budgetsApi } from '../../services/api/budgets';

// State interface definition
interface BudgetsState {
  budgets: Budget[];
  loading: boolean;
  error: string | null;
  budgetProgress: Record<string, {
    spent: number;
    remaining: number;
    lastUpdated: string;
    trend: {
      direction: 'up' | 'down' | 'stable';
      rate: number;
    };
  }>;
  alertStates: Record<string, {
    threshold: number;
    triggered: boolean;
    lastNotified: string;
  }>;
  notificationPreferences: Record<string, {
    email: boolean;
    push: boolean;
    sms: boolean;
  }>;
  cache: Record<string, {
    data: any;
    timestamp: number;
  }>;
}

// Initial state
const initialState: BudgetsState = {
  budgets: [],
  loading: false,
  error: null,
  budgetProgress: {},
  alertStates: {},
  notificationPreferences: {},
  cache: {}
};

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Async thunk for fetching all budgets with caching
 */
export const fetchBudgets = createAsyncThunk(
  'budgets/fetchBudgets',
  async (_, { rejectWithValue }) => {
    try {
      const response = await budgetsApi.getBudgets();
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch budgets');
      }
      return response.data;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Async thunk for real-time budget progress updates
 */
export const updateBudgetProgress = createAsyncThunk(
  'budgets/updateBudgetProgress',
  async (budgetId: string, { rejectWithValue }) => {
    try {
      const response = await budgetsApi.getBudgetProgress(budgetId);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update budget progress');
      }
      return { budgetId, ...response.data };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Async thunk for updating notification preferences
 */
export const updateNotificationPreferences = createAsyncThunk(
  'budgets/updateNotificationPreferences',
  async ({ budgetId, preferences }: { 
    budgetId: string; 
    preferences: { email: boolean; push: boolean; sms: boolean; }
  }, { rejectWithValue }) => {
    try {
      const response = await budgetsApi.updateBudget(budgetId, { 
        notifications: Object.entries(preferences)
          .filter(([_, enabled]) => enabled)
          .map(([type]) => type.toUpperCase())
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update notification preferences');
      }
      return { budgetId, preferences };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

// Create the budgets slice
const budgetsSlice = createSlice({
  name: 'budgets',
  initialState,
  reducers: {
    clearBudgetError: (state) => {
      state.error = null;
    },
    invalidateCache: (state) => {
      state.cache = {};
    },
    resetAlertState: (state, action) => {
      const budgetId = action.payload;
      if (state.alertStates[budgetId]) {
        state.alertStates[budgetId].triggered = false;
        state.alertStates[budgetId].lastNotified = new Date().toISOString();
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch budgets
      .addCase(fetchBudgets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBudgets.fulfilled, (state, action) => {
        state.loading = false;
        state.budgets = action.payload;
        state.cache['budgets'] = {
          data: action.payload,
          timestamp: Date.now()
        };
      })
      .addCase(fetchBudgets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update budget progress
      .addCase(updateBudgetProgress.fulfilled, (state, action) => {
        const { budgetId, spent, remaining, trend } = action.payload;
        state.budgetProgress[budgetId] = {
          spent,
          remaining,
          lastUpdated: new Date().toISOString(),
          trend
        };
        
        // Check alert threshold
        const budget = state.budgets.find(b => b.id === budgetId);
        if (budget && budget.alertThreshold) {
          const spentPercentage = (spent / (spent + remaining)) * 100;
          const alertState = {
            threshold: budget.alertThreshold,
            triggered: spentPercentage >= budget.alertThreshold,
            lastNotified: state.alertStates[budgetId]?.lastNotified || new Date().toISOString()
          };
          state.alertStates[budgetId] = alertState;
        }
      })
      // Update notification preferences
      .addCase(updateNotificationPreferences.fulfilled, (state, action) => {
        const { budgetId, preferences } = action.payload;
        state.notificationPreferences[budgetId] = preferences;
      });
  }
});

// Export actions
export const { clearBudgetError, invalidateCache, resetAlertState } = budgetsSlice.actions;

// Memoized selectors
export const selectBudgetWithProgress = createSelector(
  [(state: { budgets: BudgetsState }) => state.budgets.budgets,
   (state: { budgets: BudgetsState }) => state.budgets.budgetProgress,
   (_, budgetId: string) => budgetId],
  (budgets, progress, budgetId) => {
    const budget = budgets.find(b => b.id === budgetId);
    return budget ? {
      ...budget,
      progress: progress[budgetId] || { spent: 0, remaining: budget.amount, lastUpdated: '', trend: { direction: 'stable', rate: 0 } }
    } : null;
  }
);

export const selectBudgetAlertState = createSelector(
  [(state: { budgets: BudgetsState }) => state.budgets.alertStates,
   (_, budgetId: string) => budgetId],
  (alertStates, budgetId) => alertStates[budgetId]
);

export const selectNotificationPreferences = createSelector(
  [(state: { budgets: BudgetsState }) => state.budgets.notificationPreferences,
   (_, budgetId: string) => budgetId],
  (preferences, budgetId) => preferences[budgetId]
);

// Export reducer
export default budgetsSlice.reducer;