/**
 * Budget validation module with enhanced security and comprehensive validation rules
 * Implements validation schemas and functions for budget-related operations
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { BudgetPeriod } from '../types';
import { validateAmount } from '../../../shared/utils/validator';

// Constants for validation rules
const CATEGORY_MIN_LENGTH = 2;
const CATEGORY_MAX_LENGTH = 50;
const USER_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_ALERT_THRESHOLD = 0;
const MAX_ALERT_THRESHOLD = 100;

// Predefined budget categories for validation
const VALID_BUDGET_CATEGORIES = [
  'Housing',
  'Transportation',
  'Food',
  'Utilities',
  'Insurance',
  'Healthcare',
  'Savings',
  'Entertainment',
  'Shopping',
  'Other'
] as const;

/**
 * Enhanced Zod schema for budget creation with strict validation rules
 */
export const createBudgetSchema = z.object({
  userId: z.string()
    .regex(USER_ID_REGEX, 'Invalid user ID format')
    .min(36)
    .max(36),
  category: z.enum(VALID_BUDGET_CATEGORIES, {
    errorMap: () => ({ message: 'Invalid budget category' })
  }),
  amount: z.number()
    .positive('Amount must be greater than 0')
    .transform((val) => Number(val.toFixed(2))),
  period: z.nativeEnum(BudgetPeriod, {
    errorMap: () => ({ message: 'Invalid budget period' })
  }),
  alertThreshold: z.number()
    .min(MIN_ALERT_THRESHOLD, 'Alert threshold must be at least 0')
    .max(MAX_ALERT_THRESHOLD, 'Alert threshold cannot exceed 100')
    .transform((val) => Number(val.toFixed(2)))
});

/**
 * Enhanced Zod schema for budget updates with partial validation support
 */
export const updateBudgetSchema = z.object({
  amount: z.number()
    .positive('Amount must be greater than 0')
    .transform((val) => Number(val.toFixed(2)))
    .optional(),
  alertThreshold: z.number()
    .min(MIN_ALERT_THRESHOLD, 'Alert threshold must be at least 0')
    .max(MAX_ALERT_THRESHOLD, 'Alert threshold cannot exceed 100')
    .transform((val) => Number(val.toFixed(2)))
    .optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

/**
 * Validates a budget creation request with enhanced security checks
 * @param request - The budget creation request to validate
 * @returns Promise<boolean> - True if validation passes, throws error if validation fails
 */
export const validateCreateBudgetRequest = async (request: z.infer<typeof createBudgetSchema>): Promise<boolean> => {
  try {
    // Validate request structure using Zod schema
    const validatedData = createBudgetSchema.parse(request);

    // Additional amount validation using shared utility
    const amountValidation = validateAmount(validatedData.amount);
    if (typeof amountValidation !== 'boolean') {
      throw new Error(amountValidation.message);
    }

    // Validate period-specific constraints
    switch (validatedData.period) {
      case BudgetPeriod.MONTHLY:
        if (validatedData.amount > 100000) {
          throw new Error('Monthly budget cannot exceed $100,000');
        }
        break;
      case BudgetPeriod.QUARTERLY:
        if (validatedData.amount > 300000) {
          throw new Error('Quarterly budget cannot exceed $300,000');
        }
        break;
      case BudgetPeriod.YEARLY:
        if (validatedData.amount > 1000000) {
          throw new Error('Yearly budget cannot exceed $1,000,000');
        }
        break;
    }

    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
};

/**
 * Validates a budget update request with partial update support
 * @param request - The budget update request to validate
 * @returns Promise<boolean> - True if validation passes, throws error if validation fails
 */
export const validateUpdateBudgetRequest = async (request: z.infer<typeof updateBudgetSchema>): Promise<boolean> => {
  try {
    // Validate request structure using Zod schema
    const validatedData = updateBudgetSchema.parse(request);

    // Validate amount if provided
    if (validatedData.amount !== undefined) {
      const amountValidation = validateAmount(validatedData.amount);
      if (typeof amountValidation !== 'boolean') {
        throw new Error(amountValidation.message);
      }
    }

    // Validate alert threshold constraints if provided
    if (validatedData.alertThreshold !== undefined) {
      const threshold = validatedData.alertThreshold;
      
      // Check for logical threshold values based on common spending patterns
      if (threshold < 50 && threshold !== 0) {
        console.warn('Low alert threshold may result in frequent notifications');
      }
      if (threshold > 90) {
        console.warn('High alert threshold may not provide timely warnings');
      }
    }

    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
};