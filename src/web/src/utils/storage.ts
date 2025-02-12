/**
 * Secure local storage utility module for the Mint Clone application
 * Provides encrypted data storage, retrieval, and management functionality
 * @version 1.0.0
 */

import AsyncStorage from '@react-native-async-storage/async-storage'; // ^1.18.1
import { encryptSensitiveData, decryptSensitiveData } from '../utils/security';

// Storage key prefix for better organization and security
const STORAGE_PREFIX = 'MINT_CLONE_';

// Custom error class for storage operations
class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

// Storage key validation
const isValidKey = (key: string): boolean => {
  return key.length > 0 && key.startsWith(STORAGE_PREFIX);
};

// Ensure key has prefix
const ensureKeyPrefix = (key: string): string => {
  return key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
};

/**
 * Securely stores data in AsyncStorage with optional encryption
 * @param key - Storage key (will be prefixed if not already)
 * @param value - Data to store (any serializable value)
 * @param encrypt - Whether to encrypt the data (default: false)
 * @throws StorageError if storage operation fails
 */
export const storeData = async (
  key: string,
  value: any,
  encrypt: boolean = false
): Promise<void> => {
  try {
    // Validate inputs
    if (!key) {
      throw new StorageError('Storage key cannot be empty');
    }
    if (value === undefined || value === null) {
      throw new StorageError('Storage value cannot be undefined or null');
    }

    // Ensure key has prefix
    const prefixedKey = ensureKeyPrefix(key);

    // Convert value to string if needed
    let stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    // Encrypt if requested
    if (encrypt) {
      stringValue = encryptSensitiveData(stringValue, prefixedKey);
    }

    // Store data
    await AsyncStorage.setItem(prefixedKey, stringValue);
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`Failed to store data: ${error.message}`);
  }
};

/**
 * Retrieves and optionally decrypts data from AsyncStorage
 * @param key - Storage key (will be prefixed if not already)
 * @param encrypted - Whether the data is encrypted (default: false)
 * @returns Retrieved data in original format or null if not found
 * @throws StorageError if retrieval operation fails
 */
export const getData = async (
  key: string,
  encrypted: boolean = false
): Promise<any | null> => {
  try {
    // Validate key
    if (!key) {
      throw new StorageError('Storage key cannot be empty');
    }

    // Ensure key has prefix
    const prefixedKey = ensureKeyPrefix(key);

    // Retrieve data
    const value = await AsyncStorage.getItem(prefixedKey);
    
    if (value === null) {
      return null;
    }

    // Decrypt if needed
    let processedValue = value;
    if (encrypted) {
      processedValue = decryptSensitiveData(value, prefixedKey);
    }

    // Parse JSON if needed
    try {
      return JSON.parse(processedValue);
    } catch {
      return processedValue;
    }
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`Failed to retrieve data: ${error.message}`);
  }
};

/**
 * Securely removes data from AsyncStorage
 * @param key - Storage key (will be prefixed if not already)
 * @throws StorageError if removal operation fails
 */
export const removeData = async (key: string): Promise<void> => {
  try {
    // Validate key
    if (!key) {
      throw new StorageError('Storage key cannot be empty');
    }

    // Ensure key has prefix
    const prefixedKey = ensureKeyPrefix(key);

    // Remove data
    await AsyncStorage.removeItem(prefixedKey);

    // Verify removal
    const checkValue = await AsyncStorage.getItem(prefixedKey);
    if (checkValue !== null) {
      throw new StorageError('Failed to remove data: Item still exists');
    }
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`Failed to remove data: ${error.message}`);
  }
};

/**
 * Securely clears all application data from AsyncStorage
 * Only removes items with application prefix
 * @throws StorageError if clear operation fails
 */
export const clearStorage = async (): Promise<void> => {
  try {
    // Get all keys
    const keys = await AsyncStorage.getAllKeys();
    
    // Filter keys with application prefix
    const appKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));
    
    // Remove all application data
    if (appKeys.length > 0) {
      await AsyncStorage.multiRemove(appKeys);
    }

    // Verify clear operation
    const remainingKeys = await AsyncStorage.getAllKeys();
    const remainingAppKeys = remainingKeys.filter(key => key.startsWith(STORAGE_PREFIX));
    if (remainingAppKeys.length > 0) {
      throw new StorageError('Failed to clear storage: Some items still exist');
    }
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`Failed to clear storage: ${error.message}`);
  }
};

/**
 * Retrieves all storage keys for the application
 * Only returns keys with application prefix
 * @returns Array of storage keys
 * @throws StorageError if key retrieval fails
 */
export const getAllKeys = async (): Promise<string[]> => {
  try {
    // Get all keys
    const keys = await AsyncStorage.getAllKeys();
    
    // Filter and sort application keys
    return keys
      .filter(key => key.startsWith(STORAGE_PREFIX))
      .sort();
  } catch (error) {
    throw new StorageError(`Failed to retrieve storage keys: ${error.message}`);
  }
};