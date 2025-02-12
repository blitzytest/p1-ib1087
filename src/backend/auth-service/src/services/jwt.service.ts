// @package jsonwebtoken v9.0.0
// @package crypto latest
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { IUser, IAuthTokens } from '../../../shared/interfaces';
import { config } from '../config';
import { AuthenticationError } from '../../../shared/errors';
import { Logger } from '../../../shared/utils/logger';

/**
 * Enhanced JWT service for secure token generation, validation and management
 * Implements comprehensive security measures and token lifecycle handling
 */
export class JWTService {
  private readonly jwtSecret: string;
  private readonly accessTokenExpiry: number;
  private readonly refreshTokenExpiry: number;
  private readonly revokedTokens: Set<string>;
  private readonly logger: Logger;

  constructor() {
    // Validate and initialize configuration
    if (!config.jwtSecret || config.jwtSecret.length < 32) {
      throw new AuthenticationError('Invalid JWT secret configuration');
    }

    this.jwtSecret = config.jwtSecret;
    this.accessTokenExpiry = config.jwtExpiry;
    this.refreshTokenExpiry = config.refreshTokenExpiry;
    this.revokedTokens = new Set<string>();
    this.logger = new Logger('JWTService', {
      maskFields: ['token', 'jwtSecret']
    });

    // Setup periodic cleanup of revoked tokens
    setInterval(() => this.cleanupRevokedTokens(), 3600000); // Cleanup every hour
  }

  /**
   * Generates secure access and refresh tokens for authenticated users
   * @param user - User data for token payload
   * @returns Promise resolving to token pair with expiry
   */
  public async generateTokens(user: IUser): Promise<IAuthTokens> {
    try {
      // Validate user input
      if (!user.id || !user.email) {
        throw new AuthenticationError('Invalid user data for token generation');
      }

      // Create token payload with security claims
      const payload = {
        sub: user.id,
        email: user.email,
        iat: Math.floor(Date.now() / 1000),
        jti: crypto.randomBytes(16).toString('hex')
      };

      // Generate access token
      const accessToken = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.accessTokenExpiry,
        algorithm: 'HS512'
      });

      // Generate cryptographically secure refresh token
      const refreshToken = crypto.randomBytes(64).toString('base64');

      this.logger.info('Generated new token pair', {
        userId: user.id,
        tokenId: payload.jti
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: this.accessTokenExpiry,
        tokenType: 'Bearer'
      };
    } catch (error) {
      this.logger.error('Token generation failed', { error });
      throw new AuthenticationError('Failed to generate authentication tokens');
    }
  }

  /**
   * Verifies and decodes JWT access token
   * @param token - JWT access token to verify
   * @returns Promise resolving to decoded user data
   */
  public async verifyToken(token: string): Promise<IUser> {
    try {
      // Validate token format
      if (!token || !token.startsWith('Bearer ')) {
        throw new AuthenticationError('Invalid token format');
      }

      const accessToken = token.split(' ')[1];

      // Check if token is revoked
      if (this.revokedTokens.has(accessToken)) {
        throw new AuthenticationError('Token has been revoked');
      }

      // Verify token signature and expiration
      const decoded = jwt.verify(accessToken, this.jwtSecret, {
        algorithms: ['HS512']
      }) as jwt.JwtPayload;

      // Validate payload structure
      if (!decoded.sub || !decoded.email) {
        throw new AuthenticationError('Invalid token payload');
      }

      return {
        id: decoded.sub,
        email: decoded.email
      } as IUser;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token');
      }
      this.logger.error('Token verification failed', { error });
      throw new AuthenticationError('Token verification failed');
    }
  }

  /**
   * Refreshes access token using valid refresh token
   * @param refreshToken - Valid refresh token
   * @param user - Current user data
   * @returns Promise resolving to new token pair
   */
  public async refreshAccessToken(
    refreshToken: string,
    user: IUser
  ): Promise<IAuthTokens> {
    try {
      // Validate refresh token format
      if (!refreshToken || typeof refreshToken !== 'string') {
        throw new AuthenticationError('Invalid refresh token format');
      }

      // Check if refresh token is revoked
      if (this.revokedTokens.has(refreshToken)) {
        throw new AuthenticationError('Refresh token has been revoked');
      }

      // Generate new token pair
      return await this.generateTokens(user);
    } catch (error) {
      this.logger.error('Token refresh failed', { error });
      throw new AuthenticationError('Failed to refresh access token');
    }
  }

  /**
   * Revokes access and refresh tokens
   * @param accessToken - Access token to revoke
   * @param refreshToken - Refresh token to revoke
   */
  public async revokeToken(
    accessToken: string,
    refreshToken: string
  ): Promise<void> {
    try {
      // Add tokens to revocation list
      if (accessToken) {
        this.revokedTokens.add(accessToken);
      }
      if (refreshToken) {
        this.revokedTokens.add(refreshToken);
      }

      this.logger.info('Tokens revoked successfully', {
        accessTokenPresent: !!accessToken,
        refreshTokenPresent: !!refreshToken
      });
    } catch (error) {
      this.logger.error('Token revocation failed', { error });
      throw new AuthenticationError('Failed to revoke tokens');
    }
  }

  /**
   * Cleans up expired tokens from revocation list
   * @private
   */
  private cleanupRevokedTokens(): void {
    try {
      const initialSize = this.revokedTokens.size;
      
      for (const token of this.revokedTokens) {
        try {
          jwt.verify(token, this.jwtSecret);
        } catch (error) {
          if (error instanceof jwt.TokenExpiredError) {
            this.revokedTokens.delete(token);
          }
        }
      }

      this.logger.info('Cleaned up revoked tokens', {
        initialSize,
        finalSize: this.revokedTokens.size
      });
    } catch (error) {
      this.logger.error('Token cleanup failed', { error });
    }
  }
}