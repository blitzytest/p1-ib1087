/**
 * Type definitions and interfaces for the budget service
 * Defines core types, request/response schemas, and validation rules
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { IBudget } from '../../../shared/interfaces';

/**
 * Valid budget periods for budget creation and management
 */
export enum BudgetPeriod {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY'
}

/**
 * Budget creation request payload with validation requirements
 */
export interface CreateBudgetRequest {
  userId: string;
  category: string;
  amount: number;
  period: BudgetPeriod;
  alertThreshold: number;
}

/**
 * Zod schema for validating budget creation requests
 */
export const createBudgetSchema = z.object({
  userId: z.string().uuid(),
  category: z.string().min(1).max(100),
  amount: z.number().positive(),
  period: z.nativeEnum(BudgetPeriod),
  alertThreshold: z.number().min(0).max(100)
});

/**
 * Budget update request payload for modifying existing budgets
 */
export interface UpdateBudgetRequest {
  amount: number;
  alertThreshold: number;
}

/**
 * Zod schema for validating budget update requests
 */
export const updateBudgetSchema = z.object({
  amount: z.number().positive(),
  alertThreshold: z.number().min(0).max(100)
});

/**
 * Extended budget response with tracking and alert fields
 */
export interface BudgetResponse extends Omit<IBudget, 'alertEnabled' | 'startDate' | 'endDate'> {
  isActive: boolean;
  lastAlertSentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Budget alert configuration for notification preferences
 */
export interface BudgetAlertConfig {
  threshold: number;
  emailEnabled: boolean;
  pushEnabled: boolean;
}

/**
 * Zod schema for validating alert configurations
 */
export const budgetAlertConfigSchema = z.object({
  threshold: z.number().min(0).max(100),
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean()
});

/**
 * Budget status for tracking spending progress
 */
export interface BudgetStatus {
  currentSpending: number;
  remainingAmount: number;
  percentageUsed: number;
  daysRemaining: number;
  projectedOverage: number;
}

/**
 * Error types specific to budget operations
 */
export enum BudgetErrorType {
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_PERIOD = 'INVALID_PERIOD',
  INVALID_THRESHOLD = 'INVALID_THRESHOLD',
  DUPLICATE_CATEGORY = 'DUPLICATE_CATEGORY',
  NOT_FOUND = 'NOT_FOUND',
  UPDATE_FAILED = 'UPDATE_FAILED'
}

/**
 * Type guard for checking valid budget periods
 */
export function isBudgetPeriod(period: string): period is BudgetPeriod {
  return Object.values(BudgetPeriod).includes(period as BudgetPeriod);
}

/**
 * Type for budget service operation results
 */
export type BudgetResult<T> = {
  success: boolean;
  data?: T;
  error?: {
    type: BudgetErrorType;
    message: string;
  };
};