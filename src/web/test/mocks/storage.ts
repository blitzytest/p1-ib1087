/**
 * Mock implementation of storage utilities for testing purposes
 * Provides comprehensive simulation of AsyncStorage functionality with encryption support
 * @version 1.0.0
 */

import { encryptSensitiveData, decryptSensitiveData } from '../../src/utils/security';
import jest from 'jest';

// In-memory storage for mocking AsyncStorage
const mockStorage = new Map<string, string>();

// Storage for simulated errors
const mockStorageErrors = new Map<string, Error>();

/**
 * Mock implementation of storeData function for testing
 * @param key - Storage key
 * @param value - Value to store
 * @param encrypt - Whether to encrypt the data
 * @returns Promise resolving when storage is complete
 * @throws Error if storage fails
 */
export const mockStoreData = async (key: string, value: any, encrypt: boolean = false): Promise<void> => {
  // Validate parameters
  if (!key) {
    throw new Error('Storage key is required');
  }

  // Check for simulated errors
  const error = mockStorageErrors.get(key);
  if (error) {
    throw error;
  }

  try {
    // Convert value to string
    let stringValue: string;
    try {
      stringValue = JSON.stringify(value);
    } catch (e) {
      throw new Error(`Failed to stringify value: ${e.message}`);
    }

    // Encrypt if required
    if (encrypt) {
      try {
        stringValue = encryptSensitiveData(stringValue, 'test-encryption-key');
      } catch (e) {
        throw new Error(`Encryption failed: ${e.message}`);
      }
    }

    // Store in mock storage
    mockStorage.set(key, stringValue);
  } catch (error) {
    throw new Error(`Storage operation failed: ${error.message}`);
  }
};

/**
 * Mock implementation of getData function for testing
 * @param key - Storage key
 * @param encrypted - Whether the data is encrypted
 * @returns Promise resolving to stored data or null
 * @throws Error if retrieval fails
 */
export const mockGetData = async (key: string, encrypted: boolean = false): Promise<any | null> => {
  // Validate key
  if (!key) {
    throw new Error('Storage key is required');
  }

  // Check for simulated errors
  const error = mockStorageErrors.get(key);
  if (error) {
    throw error;
  }

  try {
    // Retrieve from mock storage
    const value = mockStorage.get(key);
    if (!value) {
      return null;
    }

    // Decrypt if needed
    let processedValue = value;
    if (encrypted) {
      try {
        processedValue = decryptSensitiveData(value, 'test-encryption-key');
      } catch (e) {
        throw new Error(`Decryption failed: ${e.message}`);
      }
    }

    // Parse JSON
    try {
      return JSON.parse(processedValue);
    } catch {
      return processedValue;
    }
  } catch (error) {
    throw new Error(`Data retrieval failed: ${error.message}`);
  }
};

/**
 * Mock implementation of removeData function for testing
 * @param key - Storage key to remove
 * @returns Promise resolving when removal is complete
 * @throws Error if removal fails
 */
export const mockRemoveData = async (key: string): Promise<void> => {
  // Validate key
  if (!key) {
    throw new Error('Storage key is required');
  }

  // Check for simulated errors
  const error = mockStorageErrors.get(key);
  if (error) {
    throw error;
  }

  try {
    mockStorage.delete(key);
  } catch (error) {
    throw new Error(`Data removal failed: ${error.message}`);
  }
};

/**
 * Mock implementation of clearStorage function for testing
 * @returns Promise resolving when storage is cleared
 * @throws Error if clear operation fails
 */
export const mockClearStorage = async (): Promise<void> => {
  // Check for simulated errors
  if (mockStorageErrors.has('clear')) {
    throw mockStorageErrors.get('clear')!;
  }

  try {
    mockStorage.clear();
  } catch (error) {
    throw new Error(`Storage clear failed: ${error.message}`);
  }
};

/**
 * Mock implementation of getAllKeys function for testing
 * @returns Promise resolving to array of storage keys
 * @throws Error if key retrieval fails
 */
export const mockGetAllKeys = async (): Promise<string[]> => {
  // Check for simulated errors
  if (mockStorageErrors.has('getAllKeys')) {
    throw mockStorageErrors.get('getAllKeys')!;
  }

  try {
    return Array.from(mockStorage.keys());
  } catch (error) {
    throw new Error(`Key retrieval failed: ${error.message}`);
  }
};

/**
 * Utility function to reset mock storage and error states between tests
 */
export const resetMockStorage = (): void => {
  mockStorage.clear();
  mockStorageErrors.clear();
  jest.clearAllMocks();
};

/**
 * Utility function to simulate storage errors for testing error scenarios
 * @param key - Storage key to simulate error for
 * @param error - Error to throw when accessing the key
 */
export const simulateStorageError = (key: string, error: Error): void => {
  mockStorageErrors.set(key, error);
};