/**
 * Type definitions for authentication service
 * Includes interfaces for user authentication, MFA, and session management
 * @version 1.0.0
 */

import { Request } from 'express'; // ^4.18.2
import { IUser, IAuthTokens } from '../../../shared/interfaces';

/**
 * Login request payload interface
 * Handles email/password authentication requests
 */
export interface ILoginRequest {
  email: string;
  password: string;
}

/**
 * Registration request payload interface
 * Handles new user registration with password confirmation
 */
export interface IRegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * Supported MFA methods enumeration
 * Implements F-101-RQ-003: Support for SMS and authenticator apps
 */
export enum MFAMethod {
  SMS = 'sms',
  AUTHENTICATOR = 'authenticator',
  EMAIL = 'email'
}

/**
 * MFA verification request payload interface
 * Handles multi-factor authentication verification
 */
export interface IMFARequest {
  userId: string;
  code: string;
  method: MFAMethod;
}

/**
 * Password reset request payload interface
 * Handles password recovery and reset functionality
 */
export interface IPasswordResetRequest {
  email: string;
  token: string;
  newPassword: string;
}

/**
 * MFA configuration settings interface
 * Manages MFA setup and configuration
 */
export interface IMFASettings {
  enabled: boolean;
  method: MFAMethod;
  secret: string;
  backupCodes: string[];
  lastVerified: Date;
}

/**
 * Session interface for managing user sessions
 */
export interface ISession {
  id: string;
  userId: string;
  deviceId?: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Extended Express Request interface with authenticated user
 * Adds type safety for authenticated routes
 */
export interface IAuthenticatedRequest extends Request {
  user: IUser;
  session: ISession;
}

/**
 * Authentication response interface
 * Combines auth tokens with user data
 */
export interface IAuthResponse {
  user: Omit<IUser, 'password'>;
  tokens: IAuthTokens;
  mfaRequired?: boolean;
}

/**
 * Password validation rules interface
 * Implements F-101-RQ-001: Password security requirements
 */
export interface IPasswordRules {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxLength: number;
}

/**
 * MFA verification response interface
 */
export interface IMFAVerificationResponse {
  success: boolean;
  remainingAttempts?: number;
  tokens?: IAuthTokens;
}

/**
 * Session management options interface
 */
export interface ISessionOptions {
  maxConcurrentSessions: number;
  sessionDuration: number;
  extendOnActivity: boolean;
}