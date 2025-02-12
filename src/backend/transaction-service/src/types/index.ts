/**
 * Type definitions module for the transaction service
 * Defines TypeScript interfaces, types, and enums for transaction processing
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { ITransaction } from '../../../shared/interfaces';

/**
 * Enum representing the current status of a transaction
 */
export enum TransactionStatus {
  PENDING = 'PENDING',
  POSTED = 'POSTED',
  CANCELLED = 'CANCELLED'
}

/**
 * Enum representing the type of transaction (credit or debit)
 */
export enum TransactionType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT'
}

/**
 * Enum for comprehensive transaction categorization
 * Supports 99.9% categorization accuracy requirement
 */
export enum TransactionCategory {
  FOOD_DINING = 'FOOD_DINING',
  SHOPPING = 'SHOPPING',
  TRANSPORTATION = 'TRANSPORTATION',
  HOUSING = 'HOUSING',
  UTILITIES = 'UTILITIES',
  OTHER = 'OTHER'
}

/**
 * Interface for detailed transaction location tracking
 */
export interface ITransactionLocation {
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

/**
 * Interface for creating new transactions
 * Includes required fields for transaction creation
 */
export interface ITransactionCreate {
  accountId: string;
  amount: number;
  category: TransactionCategory;
  description: string;
  date: Date;
  merchantName: string;
  location: ITransactionLocation;
}

/**
 * Interface for updating existing transactions
 * Supports partial updates of transaction data
 */
export interface ITransactionUpdate {
  id: string;
  category?: TransactionCategory;
  description?: string;
}

/**
 * Comprehensive interface for transaction response data
 * Includes all transaction fields and metadata
 */
export interface ITransactionResponse extends ITransaction {
  id: string;
  accountId: string;
  amount: number;
  category: TransactionCategory;
  description: string;
  date: Date;
  status: TransactionStatus;
  type: TransactionType;
  merchantName: string;
  location: ITransactionLocation;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Zod schema for transaction validation
 * Ensures data accuracy and type safety at runtime
 */
export const transactionSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  amount: z.number().min(0),
  category: z.nativeEnum(TransactionCategory),
  description: z.string().min(1),
  date: z.date(),
  status: z.nativeEnum(TransactionStatus),
  type: z.nativeEnum(TransactionType),
  merchantName: z.string().min(1),
  location: z.object({
    address: z.string(),
    city: z.string(),
    state: z.string().length(2),
    zipCode: z.string().regex(/^\d{5}(-\d{4})?$/)
  }),
  createdAt: z.date(),
  updatedAt: z.date()
});

/**
 * Type alias for validated transaction data
 */
export type ValidatedTransaction = z.infer<typeof transactionSchema>;