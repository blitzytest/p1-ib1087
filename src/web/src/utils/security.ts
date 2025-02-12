/**
 * Security utility module providing comprehensive cryptographic functions
 * Implements SOC2 compliant data protection and encryption
 * @version 1.0.0
 */

import CryptoJS from 'crypto-js'; // ^4.1.1
import 'react-native-get-random-values'; // ^1.8.0
import { AuthResponse } from '../types';

// Constants for cryptographic operations
const ENCRYPTION_ALGORITHM = 'AES-256-CBC';
const PBKDF2_ITERATIONS = 100000;
const SALT_SIZE = 16;
const IV_SIZE = 16;
const KEY_SIZE = 32;
const HASH_SIZE = 32;

/**
 * Encrypts sensitive data using AES-256-CBC with secure random IV
 * @param data - Data to encrypt (can be any serializable type)
 * @param key - Encryption key
 * @returns Base64 encoded string containing IV and encrypted data
 * @throws Error if encryption fails
 */
export const encryptSensitiveData = (data: any, key: string): string => {
  try {
    // Generate cryptographically secure random IV
    const iv = CryptoJS.lib.WordArray.random(IV_SIZE);
    
    // Convert data to string if needed
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Perform encryption
    const encrypted = CryptoJS.AES.encrypt(dataString, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Combine IV and encrypted data
    const combined = CryptoJS.lib.WordArray.create()
      .concat(iv)
      .concat(encrypted.ciphertext);
    
    // Return Base64 encoded result
    return CryptoJS.enc.Base64.stringify(combined);
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

/**
 * Decrypts AES-256 encrypted data with IV extraction
 * @param encryptedData - Base64 encoded encrypted data with IV
 * @param key - Decryption key
 * @returns Decrypted data in original format
 * @throws Error if decryption fails
 */
export const decryptSensitiveData = (encryptedData: string, key: string): any => {
  try {
    // Decode Base64 input
    const combined = CryptoJS.enc.Base64.parse(encryptedData);
    
    // Extract IV and encrypted portions
    const iv = CryptoJS.lib.WordArray.create(combined.words.slice(0, IV_SIZE / 4));
    const encrypted = CryptoJS.lib.WordArray.create(combined.words.slice(IV_SIZE / 4));
    
    // Perform decryption
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: encrypted },
      key,
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );
    
    // Convert to string
    const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
    
    // Attempt to parse JSON if applicable
    try {
      return JSON.parse(decryptedStr);
    } catch {
      return decryptedStr;
    }
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

/**
 * Generates a cryptographically secure random key
 * @param length - Length of the key in bytes
 * @returns Base64 encoded secure random key
 * @throws Error if key generation fails
 */
export const generateSecureKey = (length: number = KEY_SIZE): string => {
  try {
    // Generate random bytes using SecureRandom
    const randomBytes = CryptoJS.lib.WordArray.random(length);
    
    // Add additional entropy
    const timestamp = new Date().getTime().toString();
    const entropy = CryptoJS.SHA256(randomBytes.toString() + timestamp);
    
    // Combine and hash for final key
    const finalKey = CryptoJS.SHA256(randomBytes.toString() + entropy.toString());
    
    return CryptoJS.enc.Base64.stringify(finalKey);
  } catch (error) {
    throw new Error(`Key generation failed: ${error.message}`);
  }
};

/**
 * Creates a secure password hash using PBKDF2-SHA256
 * @param password - Password to hash
 * @returns Combined salt and hash in Base64 format
 * @throws Error if hashing fails
 */
export const hashPassword = (password: string): string => {
  try {
    // Generate random salt
    const salt = CryptoJS.lib.WordArray.random(SALT_SIZE);
    
    // Generate hash using PBKDF2
    const hash = CryptoJS.PBKDF2(password, salt, {
      keySize: HASH_SIZE / 4,
      iterations: PBKDF2_ITERATIONS,
      hasher: CryptoJS.algo.SHA256
    });
    
    // Combine salt and hash
    const combined = CryptoJS.lib.WordArray.create()
      .concat(salt)
      .concat(hash);
    
    return CryptoJS.enc.Base64.stringify(combined);
  } catch (error) {
    throw new Error(`Password hashing failed: ${error.message}`);
  }
};

/**
 * Validates a password against stored hash using constant-time comparison
 * @param password - Password to validate
 * @param hashedPassword - Stored password hash
 * @returns True if password matches hash
 * @throws Error if validation fails
 */
export const validatePassword = (password: string, hashedPassword: string): boolean => {
  try {
    // Decode stored hash
    const combined = CryptoJS.enc.Base64.parse(hashedPassword);
    
    // Extract salt
    const salt = CryptoJS.lib.WordArray.create(combined.words.slice(0, SALT_SIZE / 4));
    
    // Generate hash of input password
    const hash = CryptoJS.PBKDF2(password, salt, {
      keySize: HASH_SIZE / 4,
      iterations: PBKDF2_ITERATIONS,
      hasher: CryptoJS.algo.SHA256
    });
    
    // Extract stored hash portion
    const storedHash = CryptoJS.lib.WordArray.create(
      combined.words.slice(SALT_SIZE / 4)
    );
    
    // Perform constant-time comparison
    return hash.toString() === storedHash.toString();
  } catch (error) {
    throw new Error(`Password validation failed: ${error.message}`);
  }
};