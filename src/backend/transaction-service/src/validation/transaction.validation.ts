/**
 * Transaction validation module with comprehensive schema validation using Zod
 * Implements strict validation rules for financial transaction data integrity
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { Request, Response, NextFunction } from 'express'; // v4.18.0
import { ITransaction } from '../../../shared/interfaces';
import { validateAmount, validateDate } from '../../../shared/utils/validator';

// Transaction validation constants
export const ALLOWED_CATEGORIES = [
  'income',
  'expense',
  'transfer',
  'investment',
  'refund'
] as const;

export const TRANSACTION_ERROR_CODES = {
  INVALID_AMOUNT: 3001,
  INVALID_DATE: 3002,
  INVALID_CATEGORY: 3003,
  INVALID_MERCHANT: 3004,
  INVALID_DESCRIPTION: 3005
} as const;

const MAX_DESCRIPTION_LENGTH = 500;
const MIN_AMOUNT = 0.01;
const MAX_AMOUNT = 999999999.99;

/**
 * Comprehensive Zod schema for transaction validation
 * Implements strict type checking and data format validation
 */
export const transactionSchema = z.object({
  id: z.string().uuid({
    message: 'Invalid transaction ID format'
  }),
  accountId: z.string().uuid({
    message: 'Invalid account ID format'
  }),
  amount: z.number()
    .min(MIN_AMOUNT, `Amount must be at least ${MIN_AMOUNT}`)
    .max(MAX_AMOUNT, `Amount cannot exceed ${MAX_AMOUNT}`)
    .refine(
      (amount) => validateAmount(amount) === true,
      { message: 'Invalid transaction amount format' }
    ),
  category: z.enum(ALLOWED_CATEGORIES, {
    errorMap: () => ({ message: `Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}` })
  }),
  description: z.string()
    .min(1, 'Description is required')
    .max(MAX_DESCRIPTION_LENGTH, `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`)
    .refine(
      (desc) => !/[<>]/.test(desc),
      { message: 'Description contains invalid characters' }
    ),
  merchant: z.string()
    .min(1, 'Merchant name is required')
    .max(100, 'Merchant name cannot exceed 100 characters')
    .regex(/^[a-zA-Z0-9\s\-&'.]+$/, 'Merchant name contains invalid characters'),
  date: z.date()
    .refine(
      (date) => validateDate(date) === true,
      { message: 'Invalid transaction date' }
    )
});

/**
 * Express middleware for validating transaction requests
 * Implements detailed error handling and logging for transaction validation
 */
export const validateTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const transactionData: Partial<ITransaction> = req.body;

    // Validate transaction data against schema
    const validationResult = await transactionSchema.safeParseAsync(transactionData);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message,
        code: TRANSACTION_ERROR_CODES[
          `INVALID_${error.path[0].toString().toUpperCase()}` as keyof typeof TRANSACTION_ERROR_CODES
        ] || 3000
      }));

      res.status(400).json({
        message: 'Transaction validation failed',
        statusCode: 400,
        errorCode: errors[0].code,
        timestamp: new Date(),
        path: req.path,
        details: errors
      });
      return;
    }

    // Additional custom validations if needed
    const amountValidation = validateAmount(transactionData.amount!);
    if (amountValidation !== true) {
      res.status(400).json({
        ...amountValidation,
        timestamp: new Date(),
        path: req.path
      });
      return;
    }

    const dateValidation = validateDate(transactionData.date!);
    if (dateValidation !== true) {
      res.status(400).json({
        ...dateValidation,
        timestamp: new Date(),
        path: req.path
      });
      return;
    }

    // Store validated data in request for next middleware
    req.body = validationResult.data;
    next();
  } catch (error) {
    // Handle unexpected errors
    res.status(500).json({
      message: 'Internal validation error',
      statusCode: 500,
      errorCode: 3999,
      timestamp: new Date(),
      path: req.path,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};