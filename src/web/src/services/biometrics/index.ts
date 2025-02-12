/**
 * Biometric authentication service module providing secure biometric verification
 * Implements platform-specific biometric features with enhanced security
 * @version 1.0.0
 */

import TouchID from 'react-native-touch-id'; // ^4.4.1
import { Platform } from 'react-native'; // 0.71.0
import CryptoJS from 'crypto-js'; // ^4.1.1
import { secureStorage } from '../storage';

// Constants
const BIOMETRIC_CREDENTIALS_KEY = '@biometric_credentials';
const MAX_BIOMETRIC_ATTEMPTS = 3;
const BIOMETRIC_LOCKOUT_DURATION = 300000; // 5 minutes in milliseconds

// Interfaces
interface BiometricAvailability {
  available: boolean;
  biometryType: 'TouchID' | 'FaceID' | 'Fingerprint' | null;
  error?: string;
}

interface BiometricCredentials {
  username: string;
  token: string;
  timestamp: number;
  deviceId: string;
}

interface BiometricState {
  attempts: number;
  lastAttempt: number;
  lockoutEnd: number;
}

// Private state
let biometricState: BiometricState = {
  attempts: 0,
  lastAttempt: 0,
  lockoutEnd: 0
};

/**
 * Checks if biometric authentication is available on the device
 * @returns Promise resolving to BiometricAvailability status
 */
export const isBiometricsAvailable = async (): Promise<BiometricAvailability> => {
  try {
    const config = {
      unifiedErrors: true,
      passcodeFallback: false
    };

    // Check platform-specific biometric support
    const supported = await TouchID.isSupported(config);
    
    // Map biometry type based on platform
    let biometryType: BiometricAvailability['biometryType'] = null;
    if (Platform.OS === 'ios') {
      biometryType = supported === 'FaceID' ? 'FaceID' : 'TouchID';
    } else {
      biometryType = 'Fingerprint';
    }

    return {
      available: true,
      biometryType
    };
  } catch (error) {
    return {
      available: false,
      biometryType: null,
      error: error.message
    };
  }
};

/**
 * Retrieves stored credentials after biometric verification
 * @returns Promise resolving to decrypted credentials or null
 */
export const getBiometricCredentials = async (): Promise<BiometricCredentials | null> => {
  try {
    // Check if device is locked out
    const now = Date.now();
    if (now < biometricState.lockoutEnd) {
      throw new Error('Too many failed attempts. Please try again later.');
    }

    // Get stored encrypted credentials
    const encryptedData = await secureStorage.getItem<string>(BIOMETRIC_CREDENTIALS_KEY);
    if (!encryptedData) return null;

    // Request biometric authentication
    const authConfig = {
      title: 'Biometric Authentication',
      imageColor: '#000000',
      imageErrorColor: '#ff0000',
      sensorDescription: 'Touch sensor',
      sensorErrorDescription: 'Failed',
      cancelText: 'Cancel',
      fallbackLabel: 'Show Passcode',
      unifiedErrors: true
    };

    await TouchID.authenticate('Verify your identity', authConfig);

    // Reset attempts on successful authentication
    biometricState.attempts = 0;
    biometricState.lastAttempt = now;

    // Decrypt and return credentials
    const decrypted = CryptoJS.AES.decrypt(encryptedData, 'biometric_key').toString(CryptoJS.enc.Utf8);
    return JSON.parse(decrypted) as BiometricCredentials;

  } catch (error) {
    // Handle failed attempt
    biometricState.attempts++;
    biometricState.lastAttempt = Date.now();

    // Implement lockout if max attempts exceeded
    if (biometricState.attempts >= MAX_BIOMETRIC_ATTEMPTS) {
      biometricState.lockoutEnd = Date.now() + BIOMETRIC_LOCKOUT_DURATION;
    }

    throw error;
  }
};

/**
 * Stores encrypted credentials with biometric protection
 * @param credentials Credentials to store
 * @returns Promise resolving when credentials are stored
 */
export const storeBiometricCredentials = async (credentials: BiometricCredentials): Promise<void> => {
  try {
    // Verify biometric availability
    const { available } = await isBiometricsAvailable();
    if (!available) {
      throw new Error('Biometric authentication not available');
    }

    // Validate credentials
    if (!credentials.username || !credentials.token || !credentials.deviceId) {
      throw new Error('Invalid credentials format');
    }

    // Add timestamp
    const credentialsWithTimestamp = {
      ...credentials,
      timestamp: Date.now()
    };

    // Encrypt credentials
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(credentialsWithTimestamp),
      'biometric_key'
    ).toString();

    // Store encrypted data
    await secureStorage.setItem(BIOMETRIC_CREDENTIALS_KEY, encrypted);

    // Reset biometric state
    biometricState = {
      attempts: 0,
      lastAttempt: Date.now(),
      lockoutEnd: 0
    };
  } catch (error) {
    throw new Error(`Failed to store biometric credentials: ${error.message}`);
  }
};

/**
 * Clears stored biometric credentials
 * @returns Promise resolving when credentials are cleared
 */
export const clearBiometricCredentials = async (): Promise<void> => {
  try {
    await secureStorage.removeItem(BIOMETRIC_CREDENTIALS_KEY);
    
    // Reset biometric state
    biometricState = {
      attempts: 0,
      lastAttempt: 0,
      lockoutEnd: 0
    };
  } catch (error) {
    throw new Error(`Failed to clear biometric credentials: ${error.message}`);
  }
};