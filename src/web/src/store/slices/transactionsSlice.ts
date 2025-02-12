import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'; // ^1.9.5
import { Transaction } from '../../types/models';
import { TransactionFilters } from '../../types/api';
import { getTransactions, updateTransactionCategory } from '../../services/api/transactions';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

// Interface for pagination metadata
interface PaginationMetadata {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// Enhanced interface for transactions state
interface TransactionsState {
  entities: Record<string, Transaction>;
  ids: string[];
  loading: boolean;
  errors: Record<string, string>;
  filters: TransactionFilters | null;
  lastUpdated: number;
  pendingUpdates: Record<string, boolean>;
  pagination: PaginationMetadata;
}

// Initial state with performance optimization
const initialState: TransactionsState = {
  entities: {},
  ids: [],
  loading: false,
  errors: {},
  filters: null,
  lastUpdated: 0,
  pendingUpdates: {},
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0
  }
};

// Enhanced async thunk for fetching transactions with caching
export const fetchTransactions = createAsyncThunk(
  'transactions/fetchTransactions',
  async (filters: TransactionFilters, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { transactions: TransactionsState };
      const cacheAge = Date.now() - state.transactions.lastUpdated;
      
      // Return cached data if still valid
      if (
        cacheAge < PERFORMANCE_THRESHOLDS.CACHE_TTL * 1000 &&
        state.transactions.ids.length > 0 &&
        JSON.stringify(state.transactions.filters) === JSON.stringify(filters)
      ) {
        return {
          transactions: Object.values(state.transactions.entities),
          metadata: state.transactions.pagination
        };
      }

      const response = await getTransactions(filters);
      
      if (!response.success) {
        return rejectWithValue(response.error);
      }

      return {
        transactions: response.data,
        metadata: {
          page: filters.page,
          pageSize: filters.pageSize,
          totalItems: response.data.length,
          totalPages: Math.ceil(response.data.length / filters.pageSize)
        }
      };
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

// Enhanced async thunk for updating transaction category with optimistic updates
export const updateCategory = createAsyncThunk(
  'transactions/updateCategory',
  async ({ transactionId, category, rollbackData }: {
    transactionId: string;
    category: string;
    rollbackData: Transaction;
  }, { rejectWithValue }) => {
    try {
      const response = await updateTransactionCategory(transactionId, category);
      
      if (!response.success) {
        return rejectWithValue({ transactionId, error: response.error, rollbackData });
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue({ transactionId, error, rollbackData });
    }
  }
);

// Create the transactions slice with enhanced error handling and optimizations
const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    clearErrors: (state) => {
      state.errors = {};
    },
    clearCache: (state) => {
      state.lastUpdated = 0;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true;
        state.errors = {};
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.entities = action.payload.transactions.reduce((acc, transaction) => ({
          ...acc,
          [transaction.id]: transaction
        }), {});
        state.ids = action.payload.transactions.map(t => t.id);
        state.lastUpdated = Date.now();
        state.pagination = action.payload.metadata;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.errors['fetch'] = action.payload as string;
      })
      .addCase(updateCategory.pending, (state, action) => {
        const { transactionId } = action.meta.arg;
        state.pendingUpdates[transactionId] = true;
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        const transaction = action.payload;
        state.entities[transaction.id] = transaction;
        delete state.pendingUpdates[transaction.id];
        delete state.errors[transaction.id];
      })
      .addCase(updateCategory.rejected, (state, action: any) => {
        const { transactionId, error, rollbackData } = action.payload;
        state.entities[transactionId] = rollbackData;
        state.errors[transactionId] = error.message;
        delete state.pendingUpdates[transactionId];
      });
  }
});

// Memoized selectors for optimized state access
export const selectAllTransactions = createSelector(
  [(state: { transactions: TransactionsState }) => state.transactions],
  (transactions) => Object.values(transactions.entities)
);

export const selectTransactionsByAccount = createSelector(
  [
    (state: { transactions: TransactionsState }) => state.transactions.entities,
    (state: { transactions: TransactionsState }, accountId: string) => accountId
  ],
  (entities, accountId) => Object.values(entities).filter(t => t.accountId === accountId)
);

export const selectTransactionsByCategory = createSelector(
  [
    (state: { transactions: TransactionsState }) => state.transactions.entities,
    (state: { transactions: TransactionsState }, category: string) => category
  ],
  (entities, category) => Object.values(entities).filter(t => t.category === category)
);

export const selectTransactionErrors = (state: { transactions: TransactionsState }) => 
  state.transactions.errors;

export const selectPendingUpdates = (state: { transactions: TransactionsState }) => 
  state.transactions.pendingUpdates;

export const { clearErrors, clearCache } = transactionsSlice.actions;
export default transactionsSlice.reducer;