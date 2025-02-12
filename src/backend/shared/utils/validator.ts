/**
 * Core validation utility module for microservices
 * Provides reusable validation functions with enhanced security features
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { IErrorResponse } from '../interfaces';

// Constants for validation rules
const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const AMOUNT_MAX_DECIMALS = 2;
const MAX_TRANSACTION_AMOUNT = 999999999.99;
const MIN_TRANSACTION_AMOUNT = 0;

// RFC 5322 compliant email regex with additional security checks
const EMAIL_REGEX = /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i;

// Common disposable email domains
const DISPOSABLE_EMAIL_DOMAINS = [
  'tempmail.com',
  'throwawaymail.com',
  'mailinator.com',
  // Add more as needed
];

/**
 * Validates email format using RFC 5322 standards with enhanced domain validation
 * @param email - Email address to validate
 * @returns True if valid, IErrorResponse if invalid
 */
export const validateEmail = (email: string): boolean | IErrorResponse => {
  // Check if email is defined and is string
  if (!email || typeof email !== 'string') {
    return {
      message: 'Email is required and must be a string',
      statusCode: 400,
      errorCode: 1001
    };
  }

  // Check maximum length
  if (email.length > EMAIL_MAX_LENGTH) {
    return {
      message: `Email must not exceed ${EMAIL_MAX_LENGTH} characters`,
      statusCode: 400,
      errorCode: 1002
    };
  }

  // Validate email format
  if (!EMAIL_REGEX.test(email)) {
    return {
      message: 'Invalid email format',
      statusCode: 400,
      errorCode: 1003
    };
  }

  // Check for disposable email domains
  const domain = email.split('@')[1].toLowerCase();
  if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
    return {
      message: 'Disposable email addresses are not allowed',
      statusCode: 400,
      errorCode: 1004
    };
  }

  return true;
};

/**
 * Validates password strength against enhanced security requirements
 * @param password - Password to validate
 * @returns True if valid, IErrorResponse if invalid
 */
export const validatePassword = (password: string): boolean | IErrorResponse => {
  // Check if password is defined and is string
  if (!password || typeof password !== 'string') {
    return {
      message: 'Password is required and must be a string',
      statusCode: 400,
      errorCode: 2001
    };
  }

  // Check length requirements
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
      statusCode: 400,
      errorCode: 2002
    };
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      message: `Password must not exceed ${PASSWORD_MAX_LENGTH} characters`,
      statusCode: 400,
      errorCode: 2003
    };
  }

  // Check complexity requirements
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = (password.match(/\d/g) || []).length >= 2;
  const hasSpecialChars = (password.match(/[^A-Za-z0-9]/g) || []).length >= 2;

  if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChars) {
    return {
      message: 'Password must contain at least one uppercase letter, one lowercase letter, two numbers, and two special characters',
      statusCode: 400,
      errorCode: 2004
    };
  }

  // Check for common patterns
  const commonPatterns = [
    /^[A-Z][a-z]+\d{2,}[^A-Za-z0-9]{2,}$/, // Common pattern: Worddd##$$
    /(.)\1{2,}/, // Repeated characters
    /^(?=.*password).*$/i, // Contains 'password'
    /^(?=.*qwerty).*$/i // Contains 'qwerty'
  ];

  if (commonPatterns.some(pattern => pattern.test(password))) {
    return {
      message: 'Password contains common patterns that are not allowed',
      statusCode: 400,
      errorCode: 2005
    };
  }

  return true;
};

/**
 * Validates financial amount values with precision handling
 * @param amount - Amount to validate
 * @returns True if valid, IErrorResponse if invalid
 */
export const validateAmount = (amount: number): boolean | IErrorResponse => {
  // Check if amount is a valid number
  if (typeof amount !== 'number' || isNaN(amount)) {
    return {
      message: 'Amount must be a valid number',
      statusCode: 400,
      errorCode: 3001
    };
  }

  // Check range
  if (amount < MIN_TRANSACTION_AMOUNT || amount > MAX_TRANSACTION_AMOUNT) {
    return {
      message: `Amount must be between ${MIN_TRANSACTION_AMOUNT} and ${MAX_TRANSACTION_AMOUNT}`,
      statusCode: 400,
      errorCode: 3002
    };
  }

  // Check decimal places
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  if (decimalPlaces > AMOUNT_MAX_DECIMALS) {
    return {
      message: `Amount cannot have more than ${AMOUNT_MAX_DECIMALS} decimal places`,
      statusCode: 400,
      errorCode: 3003
    };
  }

  return true;
};

/**
 * Validates date strings and objects with timezone handling
 * @param date - Date to validate (string or Date object)
 * @returns True if valid, IErrorResponse if invalid
 */
export const validateDate = (date: Date | string): boolean | IErrorResponse => {
  let dateObj: Date;

  // Convert string to Date object if necessary
  if (typeof date === 'string') {
    dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return {
        message: 'Invalid date format',
        statusCode: 400,
        errorCode: 4001
      };
    }
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    return {
      message: 'Date must be a string or Date object',
      statusCode: 400,
      errorCode: 4002
    };
  }

  // Check if date is in future
  if (dateObj > new Date()) {
    return {
      message: 'Date cannot be in the future',
      statusCode: 400,
      errorCode: 4003
    };
  }

  // Check if date is too old (e.g., more than 100 years ago)
  const hundredYearsAgo = new Date();
  hundredYearsAgo.setFullYear(hundredYearsAgo.getFullYear() - 100);
  if (dateObj < hundredYearsAgo) {
    return {
      message: 'Date is too old',
      statusCode: 400,
      errorCode: 4004
    };
  }

  return true;
};