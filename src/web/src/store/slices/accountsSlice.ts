import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'; // ^1.9.0
import { Account, AccountType } from '../../types/models';
import { getAccounts, linkPlaidAccount, syncAccount } from '../../services/api/accounts';
import { PlaidLinkRequest } from '../../types/api';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

// State interface
interface AccountsState {
  entities: { [id: string]: Account };
  ids: string[];
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
  syncProgress: {
    [accountId: string]: {
      progress: number;
      status: 'idle' | 'syncing' | 'error';
      lastSync: number;
    };
  };
}

// Initial state
const initialState: AccountsState = {
  entities: {},
  ids: [],
  loading: false,
  error: null,
  lastFetch: null,
  syncProgress: {}
};

// Async thunks
export const fetchAccounts = createAsyncThunk(
  'accounts/fetchAccounts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await getAccounts();
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch accounts');
      }
      return response.data;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  },
  {
    condition: (_, { getState }) => {
      const { accounts } = getState() as { accounts: AccountsState };
      const lastFetch = accounts.lastFetch;
      if (lastFetch && Date.now() - lastFetch < PERFORMANCE_THRESHOLDS.CACHE_TTL * 1000) {
        return false;
      }
      return true;
    }
  }
);

export const linkAccount = createAsyncThunk(
  'accounts/linkAccount',
  async (linkRequest: PlaidLinkRequest, { rejectWithValue }) => {
    try {
      const response = await linkPlaidAccount(linkRequest);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to link account');
      }
      return response.data;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const syncAccountData = createAsyncThunk(
  'accounts/syncAccount',
  async (accountId: string, { rejectWithValue, dispatch }) => {
    try {
      dispatch(accountsSlice.actions.setSyncProgress({ 
        accountId, 
        progress: 0,
        status: 'syncing'
      }));

      const response = await syncAccount(accountId);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to sync account');
      }

      dispatch(accountsSlice.actions.setSyncProgress({ 
        accountId, 
        progress: 100,
        status: 'idle'
      }));

      return response.data;
    } catch (error) {
      dispatch(accountsSlice.actions.setSyncProgress({ 
        accountId, 
        progress: 0,
        status: 'error'
      }));
      return rejectWithValue((error as Error).message);
    }
  }
);

// Slice definition
const accountsSlice = createSlice({
  name: 'accounts',
  initialState,
  reducers: {
    setSyncProgress: (state, action) => {
      const { accountId, progress, status } = action.payload;
      state.syncProgress[accountId] = {
        progress,
        status,
        lastSync: Date.now()
      };
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAccounts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAccounts.fulfilled, (state, action) => {
        state.loading = false;
        state.entities = action.payload.reduce((acc, account) => {
          acc[account.id] = account;
          return acc;
        }, {} as { [id: string]: Account });
        state.ids = action.payload.map(account => account.id);
        state.lastFetch = Date.now();
      })
      .addCase(fetchAccounts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(linkAccount.fulfilled, (state, action) => {
        const account = action.payload;
        state.entities[account.id] = account;
        state.ids.push(account.id);
      })
      .addCase(syncAccountData.fulfilled, (state, action) => {
        const account = action.payload;
        state.entities[account.id] = account;
      });
  }
});

// Selectors
export const selectAccounts = createSelector(
  [(state: { accounts: AccountsState }) => state.accounts],
  (accounts) => Object.values(accounts.entities)
);

export const selectAccountsByType = createSelector(
  [selectAccounts, (_, type: AccountType) => type],
  (accounts, type) => accounts.filter(account => account.type === type)
);

export const selectAccountSyncStatus = createSelector(
  [(state: { accounts: AccountsState }) => state.accounts.syncProgress, (_, accountId: string) => accountId],
  (syncProgress, accountId) => syncProgress[accountId] || { progress: 0, status: 'idle', lastSync: null }
);

// Exports
export const { clearError } = accountsSlice.actions;
export default accountsSlice.reducer;