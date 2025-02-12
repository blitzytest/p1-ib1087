/**
 * Comprehensive validation utility module for the Mint Clone application
 * Implements RFC 5322 email standards and strong security requirements
 * @version 1.0.0
 */

import { User } from '../types/models';

/**
 * RFC 5322 compliant email validation regex pattern
 * Handles all valid email formats including international domains
 */
const EMAIL_REGEX = /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i;

/**
 * Password validation regex patterns
 */
const PASSWORD_PATTERNS = {
    UPPERCASE: /[A-Z]/,
    LOWERCASE: /[a-z]/,
    NUMBERS: /[0-9]/,
    SPECIAL: /[!@#$%^&*]/,
    COMMON_PATTERNS: /(password|123456|qwerty)/i
};

/**
 * Account name validation regex pattern
 * Allows letters, numbers, spaces, hyphens and underscores
 */
const ACCOUNT_NAME_REGEX = /^[a-zA-Z0-9\s\-_]+$/;

/**
 * Validates email addresses using RFC 5322 standards
 * @param email - Email address to validate
 * @returns boolean indicating if email is valid
 */
export const validateEmail = (email: string): boolean => {
    // Check for null/undefined and type
    if (!email || typeof email !== 'string') {
        return false;
    }

    // Check length constraints
    if (email.length < 3 || email.length > 254) {
        return false;
    }

    // Verify email contains exactly one @ symbol
    const atSymbolCount = (email.match(/@/g) || []).length;
    if (atSymbolCount !== 1) {
        return false;
    }

    // Validate against RFC 5322 pattern
    return EMAIL_REGEX.test(email);
};

/**
 * Validates password strength using comprehensive security requirements
 * @param password - Password to validate
 * @returns boolean indicating if password meets security requirements
 */
export const validatePassword = (password: string): boolean => {
    // Check for null/undefined and type
    if (!password || typeof password !== 'string') {
        return false;
    }

    // Check length requirements
    if (password.length < 8 || password.length > 128) {
        return false;
    }

    // Verify password complexity requirements
    const hasUppercase = PASSWORD_PATTERNS.UPPERCASE.test(password);
    const hasLowercase = PASSWORD_PATTERNS.LOWERCASE.test(password);
    const hasNumbers = PASSWORD_PATTERNS.NUMBERS.test(password);
    const hasSpecial = PASSWORD_PATTERNS.SPECIAL.test(password);
    const hasCommonPattern = PASSWORD_PATTERNS.COMMON_PATTERNS.test(password);

    return (
        hasUppercase &&
        hasLowercase &&
        hasNumbers &&
        hasSpecial &&
        !hasCommonPattern
    );
};

/**
 * Validates financial amount values with precise decimal handling
 * @param amount - Financial amount to validate
 * @returns boolean indicating if amount is valid
 */
export const validateAmount = (amount: number): boolean => {
    // Check for null/undefined and type
    if (amount === null || amount === undefined || typeof amount !== 'number') {
        return false;
    }

    // Check if amount is finite and non-negative
    if (!Number.isFinite(amount) || amount < 0) {
        return false;
    }

    // Validate decimal precision (maximum 2 decimal places)
    const decimalStr = amount.toString().split('.')[1] || '';
    if (decimalStr.length > 2) {
        return false;
    }

    // Check reasonable bounds for financial amounts
    const MAX_AMOUNT = 999999999.99; // $999,999,999.99
    return amount <= MAX_AMOUNT;
};

/**
 * Validates budget alert threshold percentage
 * @param threshold - Threshold percentage to validate
 * @returns boolean indicating if threshold is valid
 */
export const validateBudgetThreshold = (threshold: number): boolean => {
    // Check for null/undefined and type
    if (threshold === null || threshold === undefined || typeof threshold !== 'number') {
        return false;
    }

    // Check if threshold is finite and within valid range
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
        return false;
    }

    // Validate decimal precision (maximum 2 decimal places)
    const decimalStr = threshold.toString().split('.')[1] || '';
    return decimalStr.length <= 2;
};

/**
 * Validates financial account name with comprehensive character validation
 * @param name - Account name to validate
 * @returns boolean indicating if account name is valid
 */
export const validateAccountName = (name: string): boolean => {
    // Check for null/undefined and type
    if (!name || typeof name !== 'string') {
        return false;
    }

    // Check length constraints
    if (name.length < 1 || name.length > 50) {
        return false;
    }

    // Check for leading/trailing whitespace
    if (name.trim() !== name) {
        return false;
    }

    // Check for consecutive spaces
    if (/\s\s/.test(name)) {
        return false;
    }

    // Validate against allowed character pattern
    return ACCOUNT_NAME_REGEX.test(name);
};