/**
 * Investment validation schemas and middleware using Zod
 * Implements strict validation rules for investment data with enhanced security
 * @version 1.0.0
 */

import { z } from 'zod'; // ^3.22.0
import { InvestmentType } from '../types';
import { validateAmount, validateDate } from '../../../shared/utils/validator';

// Constants for validation rules
const SYMBOL_MIN_LENGTH = 1;
const SYMBOL_MAX_LENGTH = 10;
const MIN_SHARES = 0.0001;
const MAX_SHARES = 1000000;
const MIN_PERCENTAGE = 0;
const MAX_PERCENTAGE = 100;
const DECIMAL_PRECISION = 2;

/**
 * Enhanced Zod schema for investment data validation
 * Implements strict validation rules with detailed error messages
 */
export const investmentSchema = z.object({
  type: z.nativeEnum(InvestmentType, {
    errorMap: () => ({ message: 'Invalid investment type' })
  }),
  symbol: z.string()
    .min(SYMBOL_MIN_LENGTH, 'Symbol is required')
    .max(SYMBOL_MAX_LENGTH, `Symbol cannot exceed ${SYMBOL_MAX_LENGTH} characters`)
    .regex(/^[A-Z0-9.]+$/, 'Symbol must contain only uppercase letters, numbers, and dots')
    .transform(val => val.toUpperCase()),
  shares: z.number()
    .min(MIN_SHARES, `Minimum shares allowed is ${MIN_SHARES}`)
    .max(MAX_SHARES, `Maximum shares allowed is ${MAX_SHARES}`)
    .refine(
      (val) => Number(val.toFixed(4)) === val,
      'Shares can have maximum 4 decimal places'
    ),
  purchasePrice: z.number()
    .refine(
      (val) => validateAmount(val) === true,
      'Invalid purchase price amount'
    ),
  currentPrice: z.number()
    .refine(
      (val) => validateAmount(val) === true,
      'Invalid current price amount'
    ),
  purchaseDate: z.date()
    .refine(
      (val) => validateDate(val) === true,
      'Invalid purchase date'
    )
}).strict();

/**
 * Enhanced Zod schema for portfolio allocation validation
 * Ensures allocation percentages sum to exactly 100%
 */
export const allocationSchema = z.object({
  stocks: z.number()
    .min(MIN_PERCENTAGE, 'Stock allocation cannot be negative')
    .max(MAX_PERCENTAGE, 'Stock allocation cannot exceed 100%')
    .refine(
      (val) => Number(val.toFixed(DECIMAL_PRECISION)) === val,
      'Allocation must have maximum 2 decimal places'
    ),
  bonds: z.number()
    .min(MIN_PERCENTAGE, 'Bond allocation cannot be negative')
    .max(MAX_PERCENTAGE, 'Bond allocation cannot exceed 100%')
    .refine(
      (val) => Number(val.toFixed(DECIMAL_PRECISION)) === val,
      'Allocation must have maximum 2 decimal places'
    ),
  mutualFunds: z.number()
    .min(MIN_PERCENTAGE, 'Mutual fund allocation cannot be negative')
    .max(MAX_PERCENTAGE, 'Mutual fund allocation cannot exceed 100%')
    .refine(
      (val) => Number(val.toFixed(DECIMAL_PRECISION)) === val,
      'Allocation must have maximum 2 decimal places'
    ),
  etfs: z.number()
    .min(MIN_PERCENTAGE, 'ETF allocation cannot be negative')
    .max(MAX_PERCENTAGE, 'ETF allocation cannot exceed 100%')
    .refine(
      (val) => Number(val.toFixed(DECIMAL_PRECISION)) === val,
      'Allocation must have maximum 2 decimal places'
    )
}).refine(
  (data) => {
    const total = data.stocks + data.bonds + data.mutualFunds + data.etfs;
    return Math.abs(total - 100) < 0.01; // Allow for small floating point differences
  },
  'Total allocation must equal exactly 100%'
);

/**
 * Enhanced Zod schema for investment performance validation
 * Implements strict bounds checking for performance metrics
 */
export const performanceSchema = z.object({
  totalValue: z.number()
    .refine(
      (val) => validateAmount(val) === true,
      'Invalid total value amount'
    ),
  totalReturn: z.number()
    .min(-100, 'Total return cannot be less than -100%')
    .max(1000, 'Total return cannot exceed 1000%')
    .refine(
      (val) => Number(val.toFixed(DECIMAL_PRECISION)) === val,
      'Return must have maximum 2 decimal places'
    ),
  dailyReturn: z.number()
    .min(-100, 'Daily return cannot be less than -100%')
    .max(100, 'Daily return cannot exceed 100%')
    .refine(
      (val) => Number(val.toFixed(DECIMAL_PRECISION)) === val,
      'Return must have maximum 2 decimal places'
    ),
  weeklyReturn: z.number()
    .min(-100, 'Weekly return cannot be less than -100%')
    .max(200, 'Weekly return cannot exceed 200%')
    .refine(
      (val) => Number(val.toFixed(DECIMAL_PRECISION)) === val,
      'Return must have maximum 2 decimal places'
    ),
  monthlyReturn: z.number()
    .min(-100, 'Monthly return cannot be less than -100%')
    .max(500, 'Monthly return cannot exceed 500%')
    .refine(
      (val) => Number(val.toFixed(DECIMAL_PRECISION)) === val,
      'Return must have maximum 2 decimal places'
    ),
  yearlyReturn: z.number()
    .min(-100, 'Yearly return cannot be less than -100%')
    .max(1000, 'Yearly return cannot exceed 1000%')
    .refine(
      (val) => Number(val.toFixed(DECIMAL_PRECISION)) === val,
      'Return must have maximum 2 decimal places'
    )
}).strict();