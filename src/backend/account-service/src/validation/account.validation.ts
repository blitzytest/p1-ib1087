/**
 * Account validation module for account service
 * Implements comprehensive validation schemas and functions using Zod
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { IAccount } from '../../../shared/interfaces';
import { validateAmount } from '../../../shared/utils/validator';

// Validation constants
const ALLOWED_ACCOUNT_TYPES = ['checking', 'savings', 'credit', 'investment', 'loan', 'other'] as const;
const MAX_NAME_LENGTH = 100;
const MIN_BALANCE = -1000000000; // -1 billion
const MAX_BALANCE = 1000000000;  // 1 billion

// UUID v4 regex pattern for ID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Plaid account ID format regex
const PLAID_ACCOUNT_ID_REGEX = /^[a-zA-Z0-9]{10,30}$/;

/**
 * Zod schema for account creation validation
 * Enforces strict type checking and format validation
 */
export const accountCreationSchema = z.object({
  userId: z.string()
    .regex(UUID_REGEX, 'Invalid user ID format')
    .min(36, 'User ID is required')
    .max(36, 'Invalid user ID length'),
    
  plaidAccountId: z.string()
    .regex(PLAID_ACCOUNT_ID_REGEX, 'Invalid Plaid account ID format')
    .min(10, 'Plaid account ID must be at least 10 characters')
    .max(30, 'Plaid account ID cannot exceed 30 characters'),
    
  name: z.string()
    .min(1, 'Account name is required')
    .max(MAX_NAME_LENGTH, `Account name cannot exceed ${MAX_NAME_LENGTH} characters`)
    .regex(/^[\w\s\-'.&]+$/, 'Account name contains invalid characters'),
    
  type: z.enum(ALLOWED_ACCOUNT_TYPES, {
    errorMap: () => ({ message: `Account type must be one of: ${ALLOWED_ACCOUNT_TYPES.join(', ')}` })
  }),
    
  balance: z.number()
    .min(MIN_BALANCE, `Balance cannot be less than ${MIN_BALANCE}`)
    .max(MAX_BALANCE, `Balance cannot exceed ${MAX_BALANCE}`)
    .transform(val => Number(val.toFixed(2))) // Ensure 2 decimal places
});

/**
 * Zod schema for account updates
 * Supports partial updates with optional fields
 */
export const accountUpdateSchema = z.object({
  name: z.string()
    .min(1, 'Account name is required')
    .max(MAX_NAME_LENGTH, `Account name cannot exceed ${MAX_NAME_LENGTH} characters`)
    .regex(/^[\w\s\-'.&]+$/, 'Account name contains invalid characters')
    .optional(),
    
  balance: z.number()
    .min(MIN_BALANCE, `Balance cannot be less than ${MIN_BALANCE}`)
    .max(MAX_BALANCE, `Balance cannot exceed ${MAX_BALANCE}`)
    .transform(val => Number(val.toFixed(2)))
    .optional()
});

/**
 * Interface for validation results
 */
interface ValidationResult {
  success: boolean;
  errors?: string[];
  data?: any;
}

/**
 * Validates account creation data with enhanced security checks
 * @param accountData - Account creation request data
 * @returns Promise<ValidationResult> - Validation result with status and messages
 */
export const validateAccountCreation = async (accountData: Partial<IAccount>): Promise<ValidationResult> => {
  try {
    // Sanitize input data
    const sanitizedData = {
      userId: accountData.userId?.trim(),
      plaidAccountId: accountData.plaidAccountId?.trim(),
      name: accountData.name?.trim(),
      type: accountData.type?.toLowerCase(),
      balance: accountData.balance
    };

    // Validate using Zod schema
    const validatedData = accountCreationSchema.parse(sanitizedData);

    // Additional balance validation using shared utility
    const balanceValidation = validateAmount(validatedData.balance);
    if (balanceValidation !== true) {
      return {
        success: false,
        errors: [balanceValidation.message]
      };
    }

    return {
      success: true,
      data: validatedData
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => err.message)
      };
    }
    return {
      success: false,
      errors: ['Invalid account data provided']
    };
  }
};

/**
 * Validates account update data with partial update support
 * @param updateData - Account update request data
 * @returns Promise<ValidationResult> - Validation result with status and messages
 */
export const validateAccountUpdate = async (updateData: Partial<IAccount>): Promise<ValidationResult> => {
  try {
    // Sanitize input data
    const sanitizedData = {
      name: updateData.name?.trim(),
      balance: updateData.balance
    };

    // Validate using Zod schema
    const validatedData = accountUpdateSchema.parse(sanitizedData);

    // Additional balance validation if provided
    if (validatedData.balance !== undefined) {
      const balanceValidation = validateAmount(validatedData.balance);
      if (balanceValidation !== true) {
        return {
          success: false,
          errors: [balanceValidation.message]
        };
      }
    }

    return {
      success: true,
      data: validatedData
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => err.message)
      };
    }
    return {
      success: false,
      errors: ['Invalid update data provided']
    };
  }
};