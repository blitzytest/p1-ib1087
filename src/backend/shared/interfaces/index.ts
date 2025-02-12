/**
 * Centralized interfaces module for backend microservices
 * Defines shared TypeScript interfaces and types for type safety and consistency
 * @version 1.0.0
 */

/**
 * Core user interface for authentication and user management with MFA support
 */
export interface IUser {
  id: string;
  email: string;
  password: string;
  mfaEnabled: boolean;
  mfaType: string;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Authentication tokens interface for JWT token management with OAuth 2.0 support
 */
export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Financial account interface for account management with Plaid integration
 */
export interface IAccount {
  id: string;
  userId: string;
  plaidAccountId: string;
  plaidAccessToken: string;
  name: string;
  type: string;
  subtype: string;
  balance: number;
  currency: string;
  lastSync: Date;
  status: string;
}

/**
 * Transaction interface for financial transaction data with enhanced categorization
 */
export interface ITransaction {
  id: string;
  accountId: string;
  plaidTransactionId: string;
  amount: number;
  category: string;
  subcategory: string;
  description: string;
  merchant: string;
  date: Date;
  pending: boolean;
}

/**
 * Budget interface for budget tracking and management with alert support
 */
export interface IBudget {
  id: string;
  userId: string;
  category: string;
  amount: number;
  spent: number;
  period: string;
  startDate: Date;
  endDate: Date;
  alertThreshold: number;
  alertEnabled: boolean;
}

/**
 * Investment interface for investment portfolio tracking with cost basis support
 */
export interface IInvestment {
  id: string;
  accountId: string;
  type: string;
  name: string;
  symbol: string;
  value: number;
  quantity: number;
  costBasis: number;
  currency: string;
}

/**
 * Standardized error response interface with detailed error tracking
 */
export interface IErrorResponse {
  message: string;
  statusCode: number;
  errorCode: number;
  timestamp: Date;
  path: string;
  details: object;
}