/**
 * Type definitions for the Account Service
 * Includes Plaid integration types, account data structures, and API interfaces
 * @version 1.0.0
 */

import { AccountBase } from 'plaid'; // v10.0.0
import { IUser, IAccount } from '../../../shared/interfaces';

/**
 * Plaid link token response interface
 * Used for initiating the Plaid Link flow
 */
export interface IPlaidLinkToken {
  linkToken: string;
  expiration: Date;
}

/**
 * Plaid public token exchange response interface
 * Contains access credentials after successful account linking
 */
export interface IPlaidExchangeResponse {
  accessToken: string;
  itemId: string;
}

/**
 * Supported account types enum
 * Defines all financial account types supported by the system
 */
export enum IPlaidAccountType {
  CHECKING = 'checking',
  SAVINGS = 'savings',
  CREDIT = 'credit',
  INVESTMENT = 'investment',
  LOAN = 'loan',
  MORTGAGE = 'mortgage',
  BROKERAGE = 'brokerage'
}

/**
 * Account creation request interface
 * Required parameters for linking a new financial account
 */
export interface ICreateAccountRequest {
  userId: string;
  publicToken: string;
  institutionId: string;
}

/**
 * Account synchronization request interface
 * Parameters for initiating an account refresh
 */
export interface IAccountSyncRequest {
  accountId: string;
  lastSyncDate: Date;
}

/**
 * Account response interface
 * Comprehensive account data returned to clients
 */
export interface IAccountResponse {
  id: string;
  name: string;
  type: IPlaidAccountType;
  balance: number;
  currency: string;
  lastSync: Date;
  status: string;
  error?: IPlaidError;
  lastSyncAttempt: Date;
}

/**
 * Plaid error interface
 * Standardized error format for Plaid API errors
 */
export interface IPlaidError {
  errorType: string;
  errorCode: string;
  errorMessage: string;
  displayMessage: string;
}

/**
 * Extended account interface with Plaid-specific fields
 * Internal use only - not exposed to clients
 */
export interface IPlaidAccount extends AccountBase {
  userId: string;
  accessToken: string;
  lastSuccessfulSync: Date;
  syncStatus: 'success' | 'pending' | 'error';
  errorDetails?: IPlaidError;
}

/**
 * Account sync status response
 * Used for monitoring sync progress
 */
export interface IAccountSyncStatus {
  accountId: string;
  status: 'success' | 'pending' | 'error';
  lastAttempt: Date;
  nextScheduledSync: Date;
  error?: IPlaidError;
}

/**
 * Institution details interface
 * Basic information about a financial institution
 */
export interface IInstitution {
  id: string;
  name: string;
  logo: string;
  primaryColor: string;
  url: string;
  oauth: boolean;
}

/**
 * Account balance update event
 * Used for real-time balance updates
 */
export interface IBalanceUpdateEvent {
  accountId: string;
  newBalance: number;
  oldBalance: number;
  updateTime: Date;
}

/**
 * Account link status
 * Tracks the progress of account linking
 */
export type AccountLinkStatus = 
  | 'pending_link'
  | 'awaiting_credentials'
  | 'processing'
  | 'linked'
  | 'error'
  | 'disconnected';

/**
 * Account health check response
 * Used for monitoring account connection status
 */
export interface IAccountHealthCheck {
  accountId: string;
  status: AccountLinkStatus;
  lastChecked: Date;
  isHealthy: boolean;
  requiresRelink: boolean;
  errorDetails?: IPlaidError;
}