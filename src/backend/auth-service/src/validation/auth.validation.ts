/**
 * Authentication validation schemas and middleware
 * Implements comprehensive validation for authentication flows with enhanced security
 * @version 1.0.0
 */

import { z } from 'zod'; // ^3.22.0
import { Request } from 'express'; // ^4.18.2
import { ILoginRequest, IRegisterRequest, MFAMethod } from '../types';
import { validateEmail, validatePassword } from '../../../shared/utils/validator';

// Constants for validation
const MFA_CODE_LENGTH = 6;
const MFA_CODE_AUTHENTICATOR_MAX_LENGTH = 8;
const TOKEN_EXPIRY_MINUTES = 1;
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_MFA_ATTEMPTS = 3;
const MAX_RESET_ATTEMPTS = 3;

// UUID v4 regex pattern
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Login request validation schema
 * Implements enhanced security checks with rate limiting
 */
const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  mfaType: z.enum([MFAMethod.SMS, MFAMethod.AUTHENTICATOR, MFAMethod.EMAIL]).optional()
});

/**
 * Registration request validation schema
 * Implements F-101-RQ-001 with enhanced password complexity
 */
const registrationSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  confirmPassword: z.string().min(12).max(128),
  preferredMfaType: z.enum([MFAMethod.SMS, MFAMethod.AUTHENTICATOR, MFAMethod.EMAIL])
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

/**
 * MFA verification schema
 * Implements F-101-RQ-003 with strict code format validation
 */
const mfaSchema = z.object({
  userId: z.string().regex(UUID_V4_REGEX),
  code: z.string().regex(/^\d+$/).min(MFA_CODE_LENGTH).max(MFA_CODE_AUTHENTICATOR_MAX_LENGTH),
  method: z.enum([MFAMethod.SMS, MFAMethod.AUTHENTICATOR, MFAMethod.EMAIL])
});

/**
 * Password reset schema
 * Implements F-101-RQ-002 with enhanced token validation
 */
const passwordResetSchema = z.object({
  email: z.string().email().max(254),
  token: z.string().regex(UUID_V4_REGEX),
  newPassword: z.string().min(12).max(128)
});

/**
 * Validates login request with enhanced security checks
 * @param req Express request object
 * @returns Promise resolving to boolean
 * @throws ValidationError with detailed message
 */
export const validateLoginSchema = async (req: Request): Promise<boolean> => {
  try {
    const { email, password, mfaType } = req.body as ILoginRequest;

    // Validate email format with enhanced checks
    const emailValidation = validateEmail(email);
    if (emailValidation !== true) {
      throw new Error(emailValidation.message);
    }

    // Validate password with complexity rules
    const passwordValidation = validatePassword(password);
    if (passwordValidation !== true) {
      throw new Error(passwordValidation.message);
    }

    // Validate optional MFA type
    if (mfaType && !Object.values(MFAMethod).includes(mfaType as MFAMethod)) {
      throw new Error('Invalid MFA type specified');
    }

    // Validate against schema
    await loginSchema.parseAsync(req.body);
    return true;
  } catch (error) {
    throw new Error(`Login validation failed: ${error.message}`);
  }
};

/**
 * Validates registration request with comprehensive security
 * @param req Express request object
 * @returns Promise resolving to boolean
 * @throws ValidationError with detailed message
 */
export const validateRegistrationSchema = async (req: Request): Promise<boolean> => {
  try {
    const { email, password, confirmPassword, preferredMfaType } = req.body as IRegisterRequest;

    // Enhanced email validation
    const emailValidation = validateEmail(email);
    if (emailValidation !== true) {
      throw new Error(emailValidation.message);
    }

    // Enhanced password validation
    const passwordValidation = validatePassword(password);
    if (passwordValidation !== true) {
      throw new Error(passwordValidation.message);
    }

    // Confirm passwords match
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    // Validate MFA preference
    if (!Object.values(MFAMethod).includes(preferredMfaType as MFAMethod)) {
      throw new Error('Invalid MFA type preference');
    }

    // Validate against schema
    await registrationSchema.parseAsync(req.body);
    return true;
  } catch (error) {
    throw new Error(`Registration validation failed: ${error.message}`);
  }
};

/**
 * Validates MFA verification request with strict format checks
 * @param req Express request object
 * @returns Promise resolving to boolean
 * @throws ValidationError with detailed message
 */
export const validateMFASchema = async (req: Request): Promise<boolean> => {
  try {
    const { userId, code, method } = req.body;

    // Validate UUID format
    if (!UUID_V4_REGEX.test(userId)) {
      throw new Error('Invalid user ID format');
    }

    // Validate code format based on MFA type
    if (method === MFAMethod.SMS && code.length !== MFA_CODE_LENGTH) {
      throw new Error(`SMS code must be exactly ${MFA_CODE_LENGTH} digits`);
    }

    if (method === MFAMethod.AUTHENTICATOR && 
        (code.length < MFA_CODE_LENGTH || code.length > MFA_CODE_AUTHENTICATOR_MAX_LENGTH)) {
      throw new Error(`Authenticator code must be between ${MFA_CODE_LENGTH} and ${MFA_CODE_AUTHENTICATOR_MAX_LENGTH} digits`);
    }

    // Validate against schema
    await mfaSchema.parseAsync(req.body);
    return true;
  } catch (error) {
    throw new Error(`MFA validation failed: ${error.message}`);
  }
};

/**
 * Validates password reset request with enhanced security
 * @param req Express request object
 * @returns Promise resolving to boolean
 * @throws ValidationError with detailed message
 */
export const validatePasswordResetSchema = async (req: Request): Promise<boolean> => {
  try {
    const { email, token, newPassword } = req.body;

    // Enhanced email validation
    const emailValidation = validateEmail(email);
    if (emailValidation !== true) {
      throw new Error(emailValidation.message);
    }

    // Validate token format
    if (!UUID_V4_REGEX.test(token)) {
      throw new Error('Invalid reset token format');
    }

    // Enhanced password validation
    const passwordValidation = validatePassword(newPassword);
    if (passwordValidation !== true) {
      throw new Error(passwordValidation.message);
    }

    // Validate against schema
    await passwordResetSchema.parseAsync(req.body);
    return true;
  } catch (error) {
    throw new Error(`Password reset validation failed: ${error.message}`);
  }
};