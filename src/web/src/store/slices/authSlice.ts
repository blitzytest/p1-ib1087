import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { authService } from '../../services/api/auth';
import { SecurityLogger } from '../../utils/security';
import { User, AuthResponse } from '../../types';

// Security logger instance for SOC2 compliance
const securityLogger = new SecurityLogger();

// Interface for auth state
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  mfaToken: string | null;
  mfaRequired: boolean;
  isLoading: boolean;
  error: {
    code: string | null;
    message: string | null;
    details: Record<string, any> | null;
  };
  deviceFingerprint: string | null;
  sessionTimeout: number | null;
  lastActivity: number | null;
  concurrentSessions: string[];
  securityEvents: SecurityEvent[];
}

// Security event interface
interface SecurityEvent {
  type: string;
  timestamp: number;
  details: Record<string, any>;
}

// Initial state with enhanced security tracking
const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  mfaToken: null,
  mfaRequired: false,
  isLoading: false,
  error: {
    code: null,
    message: null,
    details: null
  },
  deviceFingerprint: null,
  sessionTimeout: null,
  lastActivity: null,
  concurrentSessions: [],
  securityEvents: []
};

// Create the auth slice with comprehensive security features
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<{ code: string; message: string; details?: Record<string, any> }>) => {
      state.error = {
        code: action.payload.code,
        message: action.payload.message,
        details: action.payload.details || null
      };
      securityLogger.logSecurityEvent('auth_error', {
        errorCode: action.payload.code,
        timestamp: Date.now()
      });
    },
    clearError: (state) => {
      state.error = {
        code: null,
        message: null,
        details: null
      };
    },
    setAuthData: (state, action: PayloadAction<AuthResponse>) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.mfaRequired = action.payload.mfaRequired;
      state.mfaToken = action.payload.mfaToken;
      state.sessionTimeout = Date.now() + (action.payload.expiresIn * 1000);
      state.lastActivity = Date.now();
      
      securityLogger.logAuthEvent('auth_success', {
        userId: action.payload.accessToken,
        timestamp: Date.now()
      });
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    setDeviceFingerprint: (state, action: PayloadAction<string>) => {
      state.deviceFingerprint = action.payload;
    },
    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
    },
    addSecurityEvent: (state, action: PayloadAction<SecurityEvent>) => {
      state.securityEvents.push(action.payload);
      securityLogger.logSecurityEvent(action.payload.type, action.payload.details);
    },
    updateConcurrentSessions: (state, action: PayloadAction<string[]>) => {
      state.concurrentSessions = action.payload;
    },
    resetState: (state) => {
      Object.assign(state, initialState);
    }
  }
});

// Export actions
export const {
  setLoading,
  setError,
  clearError,
  setAuthData,
  setUser,
  setDeviceFingerprint,
  updateLastActivity,
  addSecurityEvent,
  updateConcurrentSessions,
  resetState
} = authSlice.actions;

// Async thunks for auth operations
export const login = (credentials: LoginRequest, deviceInfo: DeviceInfo) => async (dispatch: any) => {
  try {
    dispatch(setLoading(true));
    dispatch(clearError());

    // Validate device fingerprint
    if (!deviceInfo.fingerprint) {
      throw new Error('Invalid device fingerprint');
    }

    const response = await authService.login(credentials, deviceInfo);
    dispatch(setAuthData(response.data));
    dispatch(setDeviceFingerprint(deviceInfo.fingerprint));

    if (!response.data.mfaRequired) {
      await authService.validateSession(deviceInfo.fingerprint);
      dispatch(addSecurityEvent({
        type: 'login_success',
        timestamp: Date.now(),
        details: { deviceId: deviceInfo.deviceId }
      }));
    }

    return response.data;
  } catch (error: any) {
    const errorResponse = authService.handleAuthError(error);
    dispatch(setError(errorResponse));
    dispatch(addSecurityEvent({
      type: 'login_failure',
      timestamp: Date.now(),
      details: { error: errorResponse.code }
    }));
    throw errorResponse;
  } finally {
    dispatch(setLoading(false));
  }
};

export const verifyMfa = (params: { mfaToken: string; code: string; method: string }) => async (dispatch: any) => {
  try {
    dispatch(setLoading(true));
    dispatch(clearError());

    const response = await authService.verifyMfa(params);
    dispatch(setAuthData(response.data));
    dispatch(addSecurityEvent({
      type: 'mfa_success',
      timestamp: Date.now(),
      details: { method: params.method }
    }));

    return response.data;
  } catch (error: any) {
    const errorResponse = authService.handleAuthError(error);
    dispatch(setError(errorResponse));
    dispatch(addSecurityEvent({
      type: 'mfa_failure',
      timestamp: Date.now(),
      details: { error: errorResponse.code }
    }));
    throw errorResponse;
  } finally {
    dispatch(setLoading(false));
  }
};

export const refreshSession = () => async (dispatch: any, getState: any) => {
  try {
    const { refreshToken, deviceFingerprint } = getState().auth;
    if (!refreshToken || !deviceFingerprint) {
      throw new Error('Invalid session state');
    }

    const response = await authService.refreshToken(refreshToken);
    dispatch(setAuthData(response.data));
    dispatch(updateLastActivity());
    dispatch(addSecurityEvent({
      type: 'token_refresh',
      timestamp: Date.now(),
      details: { success: true }
    }));

    return response.data;
  } catch (error: any) {
    const errorResponse = authService.handleAuthError(error);
    dispatch(setError(errorResponse));
    dispatch(resetState());
    dispatch(addSecurityEvent({
      type: 'token_refresh_failure',
      timestamp: Date.now(),
      details: { error: errorResponse.code }
    }));
    throw errorResponse;
  }
};

export const logout = () => async (dispatch: any) => {
  try {
    dispatch(addSecurityEvent({
      type: 'logout',
      timestamp: Date.now(),
      details: { reason: 'user_initiated' }
    }));
    dispatch(resetState());
  } catch (error) {
    console.error('Logout error:', error);
  }
};

// Export reducer
export default authSlice.reducer;