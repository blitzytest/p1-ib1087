/**
 * Core type definitions and interfaces for the Mint Clone application
 * Provides type safety and data validation support for domain models
 * @version 1.0.0
 */

/**
 * User preference settings interface defining customizable options
 */
export interface UserPreferences {
    /** UI theme selection (e.g., 'light', 'dark') */
    theme: string;
    /** User notification preferences configuration */
    notifications: NotificationSettings;
    /** Preferred currency for financial displays */
    defaultCurrency: string;
}

/**
 * Notification configuration settings interface
 */
export interface NotificationSettings {
    /** Email notification opt-in status */
    email: boolean;
    /** Push notification opt-in status */
    push: boolean;
    /** Budget alert notification opt-in status */
    budgetAlerts: boolean;
}

/**
 * Comprehensive user model interface with security and preference tracking
 */
export interface User {
    /** Unique user identifier */
    id: string;
    /** User's email address (used for authentication) */
    email: string;
    /** Multi-factor authentication status */
    mfaEnabled: boolean;
    /** Account creation timestamp */
    createdAt: Date;
    /** Last account update timestamp */
    updatedAt: Date;
    /** Most recent login timestamp */
    lastLogin: Date;
    /** User's customized preference settings */
    preferences: UserPreferences;
}

/**
 * Enumeration of supported financial account types
 */
export enum AccountType {
    CHECKING = 'CHECKING',
    SAVINGS = 'SAVINGS',
    CREDIT = 'CREDIT',
    INVESTMENT = 'INVESTMENT'
}

/**
 * Account status tracking enumeration
 */
export enum AccountStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    ERROR = 'ERROR'
}

/**
 * Financial institution information interface
 */
export interface InstitutionInfo {
    /** Unique institution identifier */
    id: string;
    /** Institution display name */
    name: string;
    /** URL to institution logo image */
    logo: string;
}

/**
 * Financial account model interface with enhanced tracking and status information
 */
export interface Account {
    /** Unique account identifier */
    id: string;
    /** Associated user identifier */
    userId: string;
    /** Plaid API account identifier */
    plaidAccountId: string;
    /** Account display name */
    name: string;
    /** Account classification type */
    type: AccountType;
    /** Current account balance */
    balance: number;
    /** Account currency code (e.g., 'USD') */
    currency: string;
    /** Last successful data synchronization timestamp */
    lastSync: Date;
    /** Current account status */
    status: AccountStatus;
    /** Associated financial institution information */
    institution: InstitutionInfo;
}