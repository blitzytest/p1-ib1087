/**
 * Type definitions for API requests, responses and data structures
 * Provides comprehensive type safety and validation for all API interactions
 * @version 1.0.0
 */

import { Transaction } from './models';
import { AxiosResponse } from 'axios'; // ^1.4.0

/**
 * Generic API response wrapper interface
 * Provides consistent response structure across all endpoints
 */
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    error: ErrorResponse | null;
    timestamp: Date;
    version: string;
}

/**
 * Error response structure for failed API requests
 */
export interface ErrorResponse {
    code: string;
    message: string;
    details: Record<string, unknown>;
}

/**
 * Login request payload interface
 */
export interface LoginRequest {
    email: string;
    password: string;
    deviceId: string;
}

/**
 * Authentication response with token management
 */
export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    mfaRequired: boolean;
    mfaToken: string | null;
    expiresIn: number;
}

/**
 * Plaid account linking metadata interface
 */
export interface PlaidLinkMetadata {
    institution: {
        name: string;
        id: string;
    };
    accounts: Array<{
        id: string;
        name: string;
        type: string;
        subtype: string | null;
    }>;
}

/**
 * Plaid account linking request interface
 */
export interface PlaidLinkRequest {
    publicToken: string;
    institutionId: string;
    accountIds: string[];
    metadata: PlaidLinkMetadata;
}

/**
 * Sort order enum for list operations
 */
export enum SortOrder {
    ASC = 'asc',
    DESC = 'desc'
}

/**
 * Transaction filtering parameters interface
 */
export interface TransactionFilters {
    startDate: Date;
    endDate: Date;
    categories: string[];
    accountIds: string[];
    minAmount: number;
    maxAmount: number;
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: SortOrder;
}

/**
 * Budget period enum
 */
export enum BudgetPeriod {
    DAILY = 'daily',
    WEEKLY = 'weekly',
    MONTHLY = 'monthly',
    YEARLY = 'yearly'
}

/**
 * Notification preference type
 */
export enum NotificationPreference {
    EMAIL = 'email',
    PUSH = 'push',
    SMS = 'sms'
}

/**
 * Budget creation request interface
 */
export interface BudgetRequest {
    category: string;
    amount: number;
    period: BudgetPeriod;
    alertThreshold: number;
    notifications: NotificationPreference[];
}

/**
 * Time range enum for investment data
 */
export enum TimeRange {
    DAY = '1D',
    WEEK = '1W',
    MONTH = '1M',
    QUARTER = '3M',
    YEAR = '1Y',
    YTD = 'YTD'
}

/**
 * Investment data aggregation type
 */
export enum AggregationType {
    DAILY = 'daily',
    WEEKLY = 'weekly',
    MONTHLY = 'monthly'
}

/**
 * Investment filtering parameters interface
 */
export interface InvestmentFilters {
    portfolioId: string;
    assetType: string[];
    timeRange: TimeRange;
    includeHistory: boolean;
    aggregationType: AggregationType;
}

/**
 * Type alias for API response wrapped in Axios
 */
export type ApiAxiosResponse<T> = AxiosResponse<ApiResponse<T>>;