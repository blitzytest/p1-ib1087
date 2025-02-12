import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { RateLimiterMemory } from 'rate-limiter-flexible'; // ^2.4.1
import httpStatus from 'http-status'; // ^1.6.0
import { AuthService } from '../services/auth.service';
import { Logger } from '../../../shared/utils/logger';
import { AuthenticationError } from '../../../shared/errors';
import {
  validateLoginSchema,
  validateRegistrationSchema,
  validateMFASchema
} from '../validation/auth.validation';
import {
  IAuthenticatedRequest,
  ILoginRequest,
  IRegisterRequest,
  IMFARequest,
  MFAMethod
} from '../types';
import { API_RATE_LIMITS } from '../../../shared/constants';

/**
 * Enhanced authentication controller implementing comprehensive security features
 * Handles user authentication flows with MFA support and audit logging
 */
export class AuthController {
  private readonly authService: AuthService;
  private readonly rateLimiter: RateLimiterMemory;
  private readonly logger: Logger;

  constructor(authService: AuthService) {
    this.authService = authService;
    this.logger = new Logger('AuthController', {
      maskFields: ['password', 'token', 'mfaSecret']
    });

    // Initialize rate limiter with configured limits
    this.rateLimiter = new RateLimiterMemory({
      points: API_RATE_LIMITS.AUTH.LIMIT,
      duration: API_RATE_LIMITS.AUTH.WINDOW_MINUTES * 60
    });
  }

  /**
   * Handles user registration with enhanced security validation
   * Implements F-101-RQ-001: Valid email verification, password rules
   */
  public register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Apply rate limiting
      await this.rateLimiter.consume(req.ip);

      // Validate registration payload
      const isValid = await validateRegistrationSchema(req);
      if (!isValid) {
        throw new AuthenticationError('Invalid registration data');
      }

      const registerData: IRegisterRequest = req.body;
      const deviceInfo = {
        userAgent: req.headers['user-agent'] || 'unknown',
        ipAddress: req.ip
      };

      // Register user with enhanced security
      const result = await this.authService.register(registerData, deviceInfo);

      this.logger.info('User registered successfully', {
        email: registerData.email,
        ip: req.ip
      });

      res.status(httpStatus.CREATED).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Registration failed', {
        error,
        ip: req.ip
      });
      next(error);
    }
  };

  /**
   * Handles user login with MFA support
   * Implements F-101: Email/password authentication with MFA
   */
  public login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Apply rate limiting
      await this.rateLimiter.consume(req.ip);

      // Validate login payload
      const isValid = await validateLoginSchema(req);
      if (!isValid) {
        throw new AuthenticationError('Invalid login credentials');
      }

      const loginData: ILoginRequest = req.body;
      const deviceInfo = {
        userAgent: req.headers['user-agent'] || 'unknown',
        ipAddress: req.ip
      };

      // Authenticate user
      const result = await this.authService.login(loginData, deviceInfo);

      this.logger.info('User logged in successfully', {
        email: loginData.email,
        ip: req.ip,
        mfaRequired: result.mfaRequired
      });

      res.status(httpStatus.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Login failed', {
        error,
        ip: req.ip
      });
      next(error);
    }
  };

  /**
   * Handles MFA verification
   * Implements F-101-RQ-003: Support for SMS and authenticator apps
   */
  public verifyMFA = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Apply rate limiting
      await this.rateLimiter.consume(req.ip);

      // Validate MFA payload
      const isValid = await validateMFASchema(req);
      if (!isValid) {
        throw new AuthenticationError('Invalid MFA verification data');
      }

      const mfaData: IMFARequest = req.body;
      const deviceInfo = {
        userAgent: req.headers['user-agent'] || 'unknown',
        ipAddress: req.ip
      };

      // Verify MFA code
      const result = await this.authService.verifyMFA(mfaData, deviceInfo);

      this.logger.info('MFA verification successful', {
        userId: mfaData.userId,
        method: mfaData.method,
        ip: req.ip
      });

      res.status(httpStatus.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('MFA verification failed', {
        error,
        ip: req.ip
      });
      next(error);
    }
  };

  /**
   * Handles MFA setup and configuration
   * Implements F-101-RQ-003: MFA setup with backup codes
   */
  public setupMFA = async (
    req: IAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { method } = req.body;
      if (!Object.values(MFAMethod).includes(method)) {
        throw new AuthenticationError('Invalid MFA method');
      }

      const result = await this.authService.setupMFA(req.user.id, method);

      this.logger.info('MFA setup completed', {
        userId: req.user.id,
        method,
        ip: req.ip
      });

      res.status(httpStatus.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('MFA setup failed', {
        error,
        userId: req.user?.id,
        ip: req.ip
      });
      next(error);
    }
  };

  /**
   * Handles secure token refresh
   * Implements F-104: Session Management
   */
  public refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      const userId = req.user?.id;

      if (!refreshToken || !userId) {
        throw new AuthenticationError('Invalid refresh token request');
      }

      const result = await this.authService.refreshToken(refreshToken, userId);

      this.logger.info('Token refreshed successfully', {
        userId,
        ip: req.ip
      });

      res.status(httpStatus.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Token refresh failed', {
        error,
        ip: req.ip
      });
      next(error);
    }
  };

  /**
   * Handles secure logout with token revocation
   */
  public logout = async (
    req: IAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { session } = req;
      const tokens = {
        accessToken: req.headers.authorization?.split(' ')[1] || '',
        refreshToken: req.body.refreshToken || ''
      };

      await this.authService.logout(req.user.id, session.id, tokens);

      this.logger.info('User logged out successfully', {
        userId: req.user.id,
        sessionId: session.id,
        ip: req.ip
      });

      res.status(httpStatus.OK).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      this.logger.error('Logout failed', {
        error,
        userId: req.user?.id,
        ip: req.ip
      });
      next(error);
    }
  };
}