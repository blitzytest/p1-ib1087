/**
 * Enhanced authentication hook providing secure user authentication with biometric support
 * Implements comprehensive security features, session management, and audit logging
 * @version 1.0.0
 */

import { useState, useCallback } from 'react'; // ^18.2.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.5
import {
  loginThunk,
  registerThunk,
  verifyMfaThunk,
  logoutThunk,
  selectIsAuthenticated,
  selectCurrentUser
} from '../../store/slices/authSlice';
import {
  isBiometricsAvailable,
  getBiometricCredentials,
  storeBiometricCredentials
} from '../../services/biometrics';
import { SecurityLogger } from '../../utils/security';

// Security logger instance
const securityLogger = new SecurityLogger();

// Interface for security metrics
interface SecurityMetrics {
  lastActivity: number;
  failedAttempts: number;
  sessionDuration: number;
  deviceVerified: boolean;
}

// Interface for enhanced auth state
interface AuthState {
  isLoading: boolean;
  error: {
    code: string | null;
    message: string | null;
    details: Record<string, any> | null;
  };
  securityMetrics: SecurityMetrics;
}

/**
 * Enhanced authentication hook with comprehensive security features
 * @returns Authentication state and secure methods
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const currentUser = useSelector(selectCurrentUser);

  // Enhanced state management
  const [state, setState] = useState<AuthState>({
    isLoading: false,
    error: {
      code: null,
      message: null,
      details: null
    },
    securityMetrics: {
      lastActivity: Date.now(),
      failedAttempts: 0,
      sessionDuration: 0,
      deviceVerified: false
    }
  });

  /**
   * Enhanced login handler with security features
   * @param credentials Login credentials
   * @param useBiometrics Enable biometric storage
   */
  const handleLogin = useCallback(async (
    credentials: { email: string; password: string },
    useBiometrics: boolean = false
  ) => {
    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: { code: null, message: null, details: null }
      }));

      // Generate device fingerprint
      const deviceInfo = {
        deviceId: await generateDeviceId(),
        fingerprint: await generateDeviceFingerprint()
      };

      // Dispatch login with enhanced security
      const response = await dispatch(loginThunk({ ...credentials, ...deviceInfo }));

      // Store biometric credentials if enabled
      if (useBiometrics && response.data) {
        const biometricAvailable = await isBiometricsAvailable();
        if (biometricAvailable.available) {
          await storeBiometricCredentials({
            username: credentials.email,
            token: response.data.accessToken,
            timestamp: Date.now(),
            deviceId: deviceInfo.deviceId
          });
        }
      }

      // Update security metrics
      setState(prev => ({
        ...prev,
        securityMetrics: {
          ...prev.securityMetrics,
          lastActivity: Date.now(),
          failedAttempts: 0,
          deviceVerified: true
        }
      }));

      securityLogger.info('Login successful', {
        userId: response.data.accessToken,
        deviceId: deviceInfo.deviceId
      });

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        },
        securityMetrics: {
          ...prev.securityMetrics,
          failedAttempts: prev.securityMetrics.failedAttempts + 1
        }
      }));

      securityLogger.warn('Login failed', {
        error: error.code,
        attempts: state.securityMetrics.failedAttempts + 1
      });

      throw error;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [dispatch]);

  /**
   * Enhanced biometric login handler
   */
  const handleBiometricLogin = useCallback(async () => {
    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: { code: null, message: null, details: null }
      }));

      // Verify biometric availability
      const biometricAvailable = await isBiometricsAvailable();
      if (!biometricAvailable.available) {
        throw new Error('Biometric authentication not available');
      }

      // Get stored credentials
      const credentials = await getBiometricCredentials();
      if (!credentials) {
        throw new Error('No biometric credentials stored');
      }

      // Verify credential freshness
      const credentialAge = Date.now() - credentials.timestamp;
      if (credentialAge > 7 * 24 * 60 * 60 * 1000) { // 7 days
        throw new Error('Biometric credentials expired');
      }

      // Perform biometric login
      await handleLogin(
        { email: credentials.username, password: '' },
        false
      );

      securityLogger.info('Biometric login successful', {
        deviceId: credentials.deviceId
      });

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: {
          code: 'BIOMETRIC_AUTH_FAILED',
          message: error.message,
          details: error.details
        }
      }));

      securityLogger.warn('Biometric login failed', {
        error: error.message
      });

      throw error;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [handleLogin]);

  /**
   * Enhanced registration handler with security validation
   */
  const handleRegister = useCallback(async (userData: {
    email: string;
    password: string;
    confirmPassword: string;
  }) => {
    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: { code: null, message: null, details: null }
      }));

      const deviceInfo = {
        deviceId: await generateDeviceId(),
        fingerprint: await generateDeviceFingerprint()
      };

      const response = await dispatch(registerThunk({ ...userData, ...deviceInfo }));

      securityLogger.info('Registration successful', {
        userId: response.data.accessToken,
        deviceId: deviceInfo.deviceId
      });

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      }));

      securityLogger.warn('Registration failed', {
        error: error.code
      });

      throw error;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [dispatch]);

  /**
   * Enhanced MFA verification handler
   */
  const handleMfaVerification = useCallback(async (
    mfaToken: string,
    code: string
  ) => {
    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: { code: null, message: null, details: null }
      }));

      const response = await dispatch(verifyMfaThunk({ mfaToken, code }));

      securityLogger.info('MFA verification successful', {
        mfaToken
      });

      return response;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      }));

      securityLogger.warn('MFA verification failed', {
        error: error.code,
        mfaToken
      });

      throw error;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [dispatch]);

  /**
   * Enhanced logout handler with session cleanup
   */
  const handleLogout = useCallback(async () => {
    try {
      setState(prev => ({
        ...prev,
        isLoading: true
      }));

      await dispatch(logoutThunk());
      
      // Clear biometric credentials
      await clearBiometricCredentials();

      // Reset security metrics
      setState(prev => ({
        ...prev,
        securityMetrics: {
          lastActivity: 0,
          failedAttempts: 0,
          sessionDuration: 0,
          deviceVerified: false
        }
      }));

      securityLogger.info('Logout successful');

    } catch (error: any) {
      securityLogger.error('Logout failed', {
        error: error.message
      });
      throw error;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [dispatch]);

  return {
    isAuthenticated,
    currentUser,
    isLoading: state.isLoading,
    error: state.error,
    securityMetrics: state.securityMetrics,
    login: handleLogin,
    loginWithBiometrics: handleBiometricLogin,
    register: handleRegister,
    verifyMfa: handleMfaVerification,
    logout: handleLogout
  };
};

// Helper function to generate device fingerprint
const generateDeviceFingerprint = async (): Promise<string> => {
  // Implementation would include device-specific identifiers
  return 'device-fingerprint';
};

// Helper function to generate device ID
const generateDeviceId = async (): Promise<string> => {
  // Implementation would generate a unique device identifier
  return 'device-id';
};

// Helper function to clear biometric credentials
const clearBiometricCredentials = async (): Promise<void> => {
  // Implementation would clear stored biometric credentials
};