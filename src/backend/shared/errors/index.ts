/**
 * Centralized error handling module for the Mint Clone application
 * Implements standardized error codes and handling across microservices
 * @version 1.0.0
 */

/**
 * Interface defining the structure of standardized error responses
 */
export interface ErrorResponse {
  message: string;
  statusCode: number;
  errorCode: number;
  timestamp: Date;
}

/**
 * Base error class providing standardized error handling capabilities
 * Extends the native Error class with additional properties for HTTP status codes
 * and internal error categorization
 */
export class BaseError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: number;
  public readonly timestamp: Date;

  constructor(message: string, statusCode: number, errorCode: number) {
    super(message);
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.timestamp = new Date();
    
    // Capture stack trace if available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Authentication error class for handling authentication and authorization failures
 * Error codes range: 1000-1999
 */
export class AuthenticationError extends BaseError {
  constructor(message: string) {
    // Generate error code in authentication range (1000-1999)
    const errorCode = 1000 + Math.floor(Math.random() * 999);
    super(message, 401, errorCode);
  }
}

/**
 * Account error class for handling account management and connection issues
 * Error codes range: 2000-2999
 */
export class AccountError extends BaseError {
  constructor(message: string) {
    // Generate error code in account range (2000-2999)
    const errorCode = 2000 + Math.floor(Math.random() * 999);
    super(message, 400, errorCode);
  }
}

/**
 * Transaction error class for handling transaction processing and validation issues
 * Error codes range: 3000-3999
 */
export class TransactionError extends BaseError {
  constructor(message: string) {
    // Generate error code in transaction range (3000-3999)
    const errorCode = 3000 + Math.floor(Math.random() * 999);
    super(message, 400, errorCode);
  }
}

/**
 * Formats any error into a standardized error response object
 * @param error - The error to format
 * @returns Standardized error response object
 */
export function formatError(error: Error): ErrorResponse {
  if (error instanceof BaseError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      errorCode: error.errorCode,
      timestamp: error.timestamp
    };
  }

  // Handle unknown errors with a generic 500 internal server error
  return {
    message: 'Internal Server Error',
    statusCode: 500,
    errorCode: 5000,
    timestamp: new Date()
  };
}

/**
 * Determines if an error is operational (can be handled) or programming error (needs fixing)
 * @param error - The error to classify
 * @returns boolean indicating if error is operational
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof BaseError) {
    // Check if error code is within known operational ranges
    const errorCode = error.errorCode;
    const operationalRanges = [
      [1000, 1999], // Authentication errors
      [2000, 2999], // Account errors
      [3000, 3999]  // Transaction errors
    ];

    return operationalRanges.some(([min, max]) => 
      errorCode >= min && errorCode <= max
    );
  }

  // Unknown errors are considered non-operational
  return false;
}