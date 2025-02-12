import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.0
import { Investment } from '../../types/models';
import { 
  getInvestments, 
  getPortfolioPerformance, 
  getAssetAllocation,
  AssetAllocation,
  PerformanceResponse 
} from '../../services/api/investments';
import { TimeRange, InvestmentFilters } from '../../types/api';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

// State interface
interface InvestmentsState {
  holdings: Investment[];
  performance: PerformanceResponse | null;
  allocation: AssetAllocation | null;
  lastSync: Date | null;
  loading: {
    holdings: boolean;
    performance: boolean;
    allocation: boolean;
  };
  error: {
    holdings: string | null;
    performance: string | null;
    allocation: string | null;
  };
}

// Initial state
const initialState: InvestmentsState = {
  holdings: [],
  performance: null,
  allocation: null,
  lastSync: null,
  loading: {
    holdings: false,
    performance: false,
    allocation: false
  },
  error: {
    holdings: null,
    performance: null,
    allocation: null
  }
};

// Async thunks
export const fetchInvestments = createAsyncThunk(
  'investments/fetchHoldings',
  async (filters: InvestmentFilters) => {
    const response = await getInvestments(filters);
    return response.data;
  }
);

export const fetchPortfolioPerformance = createAsyncThunk(
  'investments/fetchPerformance',
  async ({ portfolioId, timeRange }: { portfolioId: string; timeRange: TimeRange }) => {
    const response = await getPortfolioPerformance(portfolioId, timeRange);
    return response.data;
  }
);

export const fetchAssetAllocation = createAsyncThunk(
  'investments/fetchAllocation',
  async (portfolioId: string) => {
    const response = await getAssetAllocation(portfolioId);
    return response.data;
  }
);

// Create the slice
const investmentsSlice = createSlice({
  name: 'investments',
  initialState,
  reducers: {
    clearInvestmentErrors: (state) => {
      state.error = {
        holdings: null,
        performance: null,
        allocation: null
      };
    },
    resetInvestmentState: () => initialState
  },
  extraReducers: (builder) => {
    // Fetch investments reducers
    builder
      .addCase(fetchInvestments.pending, (state) => {
        state.loading.holdings = true;
        state.error.holdings = null;
      })
      .addCase(fetchInvestments.fulfilled, (state, action: PayloadAction<Investment[]>) => {
        state.holdings = action.payload;
        state.lastSync = new Date();
        state.loading.holdings = false;
      })
      .addCase(fetchInvestments.rejected, (state, action) => {
        state.loading.holdings = false;
        state.error.holdings = action.error.message || 'Failed to fetch investments';
      });

    // Fetch performance reducers
    builder
      .addCase(fetchPortfolioPerformance.pending, (state) => {
        state.loading.performance = true;
        state.error.performance = null;
      })
      .addCase(fetchPortfolioPerformance.fulfilled, (state, action: PayloadAction<PerformanceResponse>) => {
        state.performance = action.payload;
        state.loading.performance = false;
      })
      .addCase(fetchPortfolioPerformance.rejected, (state, action) => {
        state.loading.performance = false;
        state.error.performance = action.error.message || 'Failed to fetch performance data';
      });

    // Fetch allocation reducers
    builder
      .addCase(fetchAssetAllocation.pending, (state) => {
        state.loading.allocation = true;
        state.error.allocation = null;
      })
      .addCase(fetchAssetAllocation.fulfilled, (state, action: PayloadAction<AssetAllocation>) => {
        state.allocation = action.payload;
        state.loading.allocation = false;
      })
      .addCase(fetchAssetAllocation.rejected, (state, action) => {
        state.loading.allocation = false;
        state.error.allocation = action.error.message || 'Failed to fetch allocation data';
      });
  }
});

// Selectors
export const selectInvestments = (state: { investments: InvestmentsState }) => state.investments.holdings;
export const selectPerformance = (state: { investments: InvestmentsState }) => state.investments.performance;
export const selectAllocation = (state: { investments: InvestmentsState }) => state.investments.allocation;
export const selectInvestmentLoadingStates = (state: { investments: InvestmentsState }) => state.investments.loading;
export const selectInvestmentErrors = (state: { investments: InvestmentsState }) => state.investments.error;
export const selectLastSync = (state: { investments: InvestmentsState }) => state.investments.lastSync;
export const selectIsStale = (state: { investments: InvestmentsState }) => {
  if (!state.investments.lastSync) return true;
  const staleDuration = PERFORMANCE_THRESHOLDS.STALE_DATA_THRESHOLD * 1000; // Convert to milliseconds
  return Date.now() - state.investments.lastSync.getTime() > staleDuration;
};

// Export actions and reducer
export const { clearInvestmentErrors, resetInvestmentState } = investmentsSlice.actions;
export default investmentsSlice.reducer;