import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.5
import { Theme } from '../../types/theme';

// Interface for alert notifications
interface Alert {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  autoHide: boolean;
  duration: number;
  createdAt: number;
}

// Interface for UI state
interface UIState {
  theme: Theme;
  currentBreakpoint: string;
  isLoading: boolean;
  activeModals: string[];
  alerts: Alert[];
  stateVersion: number;
}

// Constants
const MAX_MODALS = 3;
const MAX_ALERTS = 5;
const DEFAULT_ALERT_DURATION = 5000;

// Initial state
const initialState: UIState = {
  theme: {} as Theme, // Theme will be initialized by app
  currentBreakpoint: 'mobileL',
  isLoading: false,
  activeModals: [],
  alerts: [],
  stateVersion: 1
};

// Create UI slice
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<Theme>) => {
      // Validate theme structure
      const { colors, typography, spacing, breakpoints } = action.payload;
      if (!colors || !typography || !spacing || !breakpoints) {
        console.error('Invalid theme structure');
        return;
      }

      // Only update if theme actually changed
      if (JSON.stringify(state.theme) !== JSON.stringify(action.payload)) {
        state.theme = action.payload;
        // Analytics event
        console.log('Theme updated', { timestamp: Date.now() });
      }
    },

    setBreakpoint: (state, action: PayloadAction<string>) => {
      // Validate breakpoint
      const validBreakpoints = ['mobileS', 'mobileL', 'tablet', 'desktop'];
      if (!validBreakpoints.includes(action.payload)) {
        console.error('Invalid breakpoint');
        return;
      }

      const previousBreakpoint = state.currentBreakpoint;
      state.currentBreakpoint = action.payload;

      // Clean up modals when switching to mobile
      if (action.payload.includes('mobile') && !previousBreakpoint.includes('mobile')) {
        state.activeModals = [];
      }

      // Log breakpoint change
      console.log('Breakpoint changed', { 
        from: previousBreakpoint, 
        to: action.payload,
        timestamp: Date.now()
      });
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      const startTime = state.isLoading ? Date.now() : 0;
      state.isLoading = action.payload;

      // Track loading duration
      if (!action.payload && startTime) {
        const duration = Date.now() - startTime;
        // Alert if loading takes too long (>3s)
        if (duration > 3000) {
          console.warn('Loading performance threshold exceeded', { duration });
        }
      }
    },

    showModal: (state, action: PayloadAction<string>) => {
      // Check modal limit
      if (state.activeModals.length >= MAX_MODALS) {
        console.warn('Maximum modal limit reached');
        return;
      }

      // Validate modal ID
      if (!action.payload || state.activeModals.includes(action.payload)) {
        return;
      }

      state.activeModals.push(action.payload);
      console.log('Modal shown', { modalId: action.payload, timestamp: Date.now() });
    },

    hideModal: (state, action: PayloadAction<string>) => {
      state.activeModals = state.activeModals.filter(id => id !== action.payload);
      console.log('Modal hidden', { modalId: action.payload, timestamp: Date.now() });
    },

    showAlert: (state, action: PayloadAction<Alert>) => {
      // Validate alert
      if (!action.payload.id || !action.payload.message) {
        console.error('Invalid alert payload');
        return;
      }

      // Add timestamp
      const alert = {
        ...action.payload,
        createdAt: Date.now(),
        duration: action.payload.duration || DEFAULT_ALERT_DURATION
      };

      // Enforce alerts limit
      if (state.alerts.length >= MAX_ALERTS) {
        state.alerts.shift(); // Remove oldest alert
      }

      state.alerts.push(alert);

      // Clean up old alerts (>1 hour)
      state.alerts = state.alerts.filter(a => 
        Date.now() - a.createdAt < 3600000
      );
    },

    hideAlert: (state, action: PayloadAction<string>) => {
      state.alerts = state.alerts.filter(alert => alert.id !== action.payload);
    }
  }
});

// Export actions and reducer
export const uiActions = uiSlice.actions;
export default uiSlice.reducer;