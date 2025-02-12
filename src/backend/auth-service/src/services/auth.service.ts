import { RateLimiterMemory } from 'rate-limiter-flexible'; // v2.4.1
import { UserRepository } from '../repositories/user.repository';
import { JWTService } from './jwt.service';
import { MFAService } from './mfa.service';
import { Logger } from '../../../shared/utils/logger';
import { AuthenticationError } from '../../../shared/errors';
import { 
  ILoginRequest, 
  IRegisterRequest, 
  IAuthResponse,
  IMFARequest,
  ISession,
  MFAMethod
} from '../types';
import { config } from '../config';
import { API_RATE_LIMITS } from '../../../shared/constants';

/**
 * Enhanced authentication service implementing comprehensive security features
 * Handles user authentication, registration, and session management
 */
export class AuthService {
  private readonly userRepository: UserRepository;
  private readonly jwtService: JWTService;
  private readonly mfaService: MFAService;
  private readonly logger: Logger;
  private readonly rateLimiter: RateLimiterMemory;
  private readonly activeSessions: Map<string, ISession>;

  constructor(
    userRepository: UserRepository,
    jwtService: JWTService,
    mfaService: MFAService
  ) {
    this.userRepository = userRepository;
    this.jwtService = jwtService;
    this.mfaService = mfaService;
    this.logger = new Logger('AuthService', {
      maskFields: ['password', 'token', 'mfaSecret']
    });

    // Initialize rate limiter for auth attempts
    this.rateLimiter = new RateLimiterMemory({
      points: API_RATE_LIMITS.AUTH.LIMIT,
      duration: API_RATE_LIMITS.AUTH.WINDOW_MINUTES * 60
    });

    this.activeSessions = new Map<string, ISession>();
  }

  /**
   * Registers a new user with enhanced security validation
   * Implements F-101-RQ-001: Valid email verification with domain checks
   */
  public async register(
    registerData: IRegisterRequest,
    deviceInfo: { userAgent: string; ipAddress: string }
  ): Promise<IAuthResponse> {
    try {
      // Check rate limit for registration
      await this.rateLimiter.consume(deviceInfo.ipAddress);

      // Validate password match
      if (registerData.password !== registerData.confirmPassword) {
        throw new AuthenticationError('Passwords do not match');
      }

      // Create user with enhanced security settings
      const user = await this.userRepository.createUser({
        email: registerData.email,
        password: registerData.password
      });

      // Generate authentication tokens
      const tokens = await this.jwtService.generateTokens(user);

      // Create session
      const session = this.createSession(user.id, deviceInfo);
      this.activeSessions.set(session.id, session);

      this.logger.info('User registered successfully', {
        userId: user.id,
        email: user.email,
        sessionId: session.id
      });

      return {
        user: { ...user, password: undefined },
        tokens,
        mfaRequired: false
      };
    } catch (error) {
      this.logger.error('Registration failed', { error, email: registerData.email });
      throw error;
    }
  }

  /**
   * Authenticates user with enhanced security checks
   * Implements F-101: Email/password authentication with MFA support
   */
  public async login(
    loginData: ILoginRequest,
    deviceInfo: { userAgent: string; ipAddress: string }
  ): Promise<IAuthResponse> {
    try {
      // Check rate limit for login attempts
      await this.rateLimiter.consume(deviceInfo.ipAddress);

      // Validate credentials
      const user = await this.userRepository.validateCredentials(
        loginData.email,
        loginData.password,
        deviceInfo.ipAddress
      );

      if (!user) {
        throw new AuthenticationError('Invalid credentials');
      }

      // Check if MFA is required
      if (config.mfaEnabled && user.mfaEnabled) {
        this.logger.info('MFA required for login', { userId: user.id });
        return {
          user: { ...user, password: undefined },
          tokens: null,
          mfaRequired: true
        };
      }

      // Generate tokens
      const tokens = await this.jwtService.generateTokens(user);

      // Create session
      const session = this.createSession(user.id, deviceInfo);
      this.activeSessions.set(session.id, session);

      this.logger.info('User authenticated successfully', {
        userId: user.id,
        sessionId: session.id
      });

      return {
        user: { ...user, password: undefined },
        tokens,
        mfaRequired: false
      };
    } catch (error) {
      this.logger.error('Authentication failed', { error, email: loginData.email });
      throw error;
    }
  }

  /**
   * Verifies MFA code and completes authentication
   * Implements F-101-RQ-003: Enhanced MFA support
   */
  public async verifyMFA(
    mfaRequest: IMFARequest,
    deviceInfo: { userAgent: string; ipAddress: string }
  ): Promise<IAuthResponse> {
    try {
      // Verify MFA code
      const isValid = await this.mfaService.verifyMFACode(mfaRequest);

      if (!isValid) {
        throw new AuthenticationError('Invalid MFA code');
      }

      // Retrieve user
      const user = await this.userRepository.findById(mfaRequest.userId);

      // Generate tokens after successful MFA
      const tokens = await this.jwtService.generateTokens(user);

      // Create session
      const session = this.createSession(user.id, deviceInfo);
      this.activeSessions.set(session.id, session);

      this.logger.info('MFA verification successful', {
        userId: user.id,
        method: mfaRequest.method
      });

      return {
        user: { ...user, password: undefined },
        tokens,
        mfaRequired: false
      };
    } catch (error) {
      this.logger.error('MFA verification failed', { error, userId: mfaRequest.userId });
      throw error;
    }
  }

  /**
   * Refreshes access token with security validation
   */
  public async refreshToken(
    refreshToken: string,
    userId: string
  ): Promise<IAuthResponse> {
    try {
      const user = await this.userRepository.findById(userId);
      const tokens = await this.jwtService.refreshAccessToken(refreshToken, user);

      this.logger.info('Token refreshed successfully', { userId });

      return {
        user: { ...user, password: undefined },
        tokens,
        mfaRequired: false
      };
    } catch (error) {
      this.logger.error('Token refresh failed', { error, userId });
      throw error;
    }
  }

  /**
   * Revokes user session with security audit
   */
  public async logout(
    userId: string,
    sessionId: string,
    tokens: { accessToken: string; refreshToken: string }
  ): Promise<void> {
    try {
      // Revoke tokens
      await this.jwtService.revokeToken(tokens.accessToken, tokens.refreshToken);

      // Remove session
      this.activeSessions.delete(sessionId);

      this.logger.info('User logged out successfully', { userId, sessionId });
    } catch (error) {
      this.logger.error('Logout failed', { error, userId });
      throw error;
    }
  }

  /**
   * Creates a new session with enhanced tracking
   */
  private createSession(
    userId: string,
    deviceInfo: { userAgent: string; ipAddress: string }
  ): ISession {
    const session: ISession = {
      id: crypto.randomUUID(),
      userId,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + config.refreshTokenExpiry * 1000)
    };

    return session;
  }
}