/**
 * Core storage service module providing secure local data persistence and caching
 * Implements AES-256 encryption, comprehensive error handling, and type safety
 * @version 1.0.0
 */

import AsyncStorage from '@react-native-async-storage/async-storage'; // ^1.17.11
import { encryptSensitiveData, decryptSensitiveData } from '../../utils/security';
import { ValidationResult } from '../../types';

// Storage constants
const STORAGE_VERSION = '1.0';
const STORAGE_QUOTA_LIMIT = 50 * 1024 * 1024; // 50MB
const STORAGE_ENCRYPTION_KEY = process.env.REACT_APP_STORAGE_ENCRYPTION_KEY;

// Storage option interfaces
interface StorageOptions {
  encrypt?: boolean;
  version?: string;
  ttl?: number;
}

interface StorageMetadata {
  version: string;
  createdAt: number;
  updatedAt: number;
  size: number;
  encrypted: boolean;
  ttl?: number;
}

interface StorageKey {
  key: string;
  metadata: StorageMetadata;
}

interface StorageMetrics {
  totalSize: number;
  quotaLimit: number;
  quotaUsed: number;
  keyCount: number;
  encryptedCount: number;
}

// Custom error class for storage operations
class StorageError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Stores data securely in local storage with encryption and validation
 * @param key Storage key identifier
 * @param value Data to store
 * @param options Storage options including encryption and TTL
 * @throws StorageError if operation fails
 */
export const setItem = async (
  key: string,
  value: any,
  options: StorageOptions = {}
): Promise<void> => {
  try {
    // Validate inputs
    if (!key) throw new StorageError('Storage key is required', 'INVALID_KEY');
    if (value === undefined) throw new StorageError('Storage value is required', 'INVALID_VALUE');

    // Check storage quota
    const metrics = await getStorageMetrics();
    const valueSize = new Blob([JSON.stringify(value)]).size;
    if (metrics.totalSize + valueSize > STORAGE_QUOTA_LIMIT) {
      throw new StorageError('Storage quota exceeded', 'QUOTA_EXCEEDED');
    }

    // Prepare storage data
    const metadata: StorageMetadata = {
      version: options.version || STORAGE_VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      size: valueSize,
      encrypted: Boolean(options.encrypt),
      ttl: options.ttl
    };

    // Encrypt data if requested
    let storageValue = value;
    if (options.encrypt && STORAGE_ENCRYPTION_KEY) {
      storageValue = encryptSensitiveData(value, STORAGE_ENCRYPTION_KEY);
      metadata.encrypted = true;
    }

    // Store data with metadata
    const storageItem = {
      metadata,
      value: storageValue
    };

    await AsyncStorage.setItem(key, JSON.stringify(storageItem));
  } catch (error) {
    throw new StorageError(
      `Failed to store data: ${error.message}`,
      error.code || 'STORAGE_ERROR'
    );
  }
};

/**
 * Retrieves and validates data from local storage
 * @param key Storage key identifier
 * @param options Storage options for retrieval
 * @returns Retrieved data in original format
 * @throws StorageError if operation fails
 */
export const getItem = async <T>(
  key: string,
  options: StorageOptions = {}
): Promise<T | null> => {
  try {
    // Validate key
    if (!key) throw new StorageError('Storage key is required', 'INVALID_KEY');

    // Retrieve stored data
    const storedItem = await AsyncStorage.getItem(key);
    if (!storedItem) return null;

    // Parse stored data
    const { metadata, value } = JSON.parse(storedItem);

    // Check TTL expiration
    if (metadata.ttl && Date.now() > metadata.createdAt + metadata.ttl) {
      await removeItem(key);
      return null;
    }

    // Decrypt if necessary
    let finalValue = value;
    if (metadata.encrypted && STORAGE_ENCRYPTION_KEY) {
      finalValue = decryptSensitiveData(value, STORAGE_ENCRYPTION_KEY);
    }

    return finalValue as T;
  } catch (error) {
    throw new StorageError(
      `Failed to retrieve data: ${error.message}`,
      error.code || 'STORAGE_ERROR'
    );
  }
};

/**
 * Securely removes data from local storage
 * @param key Storage key identifier
 * @throws StorageError if operation fails
 */
export const removeItem = async (key: string): Promise<void> => {
  try {
    if (!key) throw new StorageError('Storage key is required', 'INVALID_KEY');
    await AsyncStorage.removeItem(key);
  } catch (error) {
    throw new StorageError(
      `Failed to remove data: ${error.message}`,
      error.code || 'STORAGE_ERROR'
    );
  }
};

/**
 * Securely clears all data from local storage
 * @throws StorageError if operation fails
 */
export const clear = async (): Promise<void> => {
  try {
    await AsyncStorage.clear();
  } catch (error) {
    throw new StorageError(
      `Failed to clear storage: ${error.message}`,
      error.code || 'STORAGE_ERROR'
    );
  }
};

/**
 * Retrieves all storage keys with metadata
 * @returns Array of storage keys and their metadata
 * @throws StorageError if operation fails
 */
export const getAllKeys = async (): Promise<StorageKey[]> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const storageKeys: StorageKey[] = [];

    for (const key of keys) {
      const storedItem = await AsyncStorage.getItem(key);
      if (storedItem) {
        const { metadata } = JSON.parse(storedItem);
        storageKeys.push({ key, metadata });
      }
    }

    return storageKeys;
  } catch (error) {
    throw new StorageError(
      `Failed to retrieve keys: ${error.message}`,
      error.code || 'STORAGE_ERROR'
    );
  }
};

/**
 * Retrieves storage usage metrics and quota information
 * @returns Storage metrics including usage and quotas
 * @throws StorageError if operation fails
 */
export const getStorageMetrics = async (): Promise<StorageMetrics> => {
  try {
    const keys = await getAllKeys();
    let totalSize = 0;
    let encryptedCount = 0;

    for (const { metadata } of keys) {
      totalSize += metadata.size;
      if (metadata.encrypted) encryptedCount++;
    }

    return {
      totalSize,
      quotaLimit: STORAGE_QUOTA_LIMIT,
      quotaUsed: (totalSize / STORAGE_QUOTA_LIMIT) * 100,
      keyCount: keys.length,
      encryptedCount
    };
  } catch (error) {
    throw new StorageError(
      `Failed to retrieve metrics: ${error.message}`,
      error.code || 'STORAGE_ERROR'
    );
  }
};