import mongoose from 'mongoose';
import { RateLimiterMongo } from 'rate-limiter-flexible';
import { KMS } from 'aws-sdk';
import { UserModel } from '../models/user.model';
import { IUser } from '../../../shared/interfaces';
import { Logger } from '../../../shared/utils/logger';
import { EncryptionService } from '../../../shared/utils/encryption';
import { validateEmail, validatePassword } from '../../../shared/utils/validator';
import { AuthenticationError } from '../../../shared/errors';

// Constants for rate limiting and security
const MAX_WRONG_ATTEMPTS_BY_IP_PER_DAY = 100;
const MAX_CONSECUTIVE_FAILS_BY_EMAIL = 5;
const BLOCK_DURATION = 60 * 60 * 24; // 24 hours in seconds

export class UserRepository {
  private readonly userModel: typeof UserModel;
  private readonly logger: Logger;
  private readonly rateLimiter: RateLimiterMongo;
  private readonly encryptionService: EncryptionService;

  constructor() {
    this.userModel = UserModel;
    this.logger = new Logger('UserRepository', {
      maskFields: ['password', 'mfaSecret']
    });

    // Initialize rate limiter with MongoDB
    this.rateLimiter = new RateLimiterMongo({
      storeClient: mongoose.connection,
      keyPrefix: 'login_fail',
      points: MAX_WRONG_ATTEMPTS_BY_IP_PER_DAY,
      duration: BLOCK_DURATION,
      blockDuration: BLOCK_DURATION
    });

    // Initialize encryption service
    this.encryptionService = new EncryptionService({
      region: process.env.AWS_REGION || 'us-east-1',
      keyId: process.env.KMS_KEY_ID || '',
      keyTTL: 3600000 // 1 hour
    });
  }

  /**
   * Creates a new user with enhanced security validation
   */
  public async createUser(userData: Partial<IUser>): Promise<IUser> {
    try {
      // Validate user data
      const emailValidation = validateEmail(userData.email);
      const passwordValidation = validatePassword(userData.password);

      if (emailValidation !== true) {
        throw new AuthenticationError(emailValidation.message);
      }

      if (passwordValidation !== true) {
        throw new AuthenticationError(passwordValidation.message);
      }

      // Check for existing user
      const existingUser = await this.userModel.findOne({ email: userData.email });
      if (existingUser) {
        throw new AuthenticationError('Email already registered');
      }

      // Create user with enhanced security
      const user = new this.userModel({
        ...userData,
        mfaEnabled: false,
        mfaType: 'none',
        failedLoginAttempts: 0,
        lastLogin: null
      });

      // Save user
      const savedUser = await user.save();

      this.logger.info('User created successfully', {
        userId: savedUser.id,
        email: savedUser.email
      });

      // Return user without sensitive data
      const { password, mfaSecret, ...userWithoutSensitive } = savedUser.toObject();
      return userWithoutSensitive as IUser;

    } catch (error) {
      this.logger.error('User creation failed', { error, email: userData.email });
      throw error;
    }
  }

  /**
   * Validates user credentials with rate limiting and security checks
   */
  public async validateCredentials(
    email: string,
    password: string,
    ipAddress: string
  ): Promise<IUser | null> {
    try {
      // Check IP-based rate limit
      try {
        await this.rateLimiter.consume(ipAddress);
      } catch (error) {
        throw new AuthenticationError('Too many login attempts. Please try again later.');
      }

      // Find user and include sensitive fields
      const user = await this.userModel.findOne({ email })
        .select('+password +mfaSecret +failedLoginAttempts');

      if (!user) {
        throw new AuthenticationError('Invalid credentials');
      }

      // Check if account is locked
      if (user.accountLocked && user.lockUntil && user.lockUntil > new Date()) {
        throw new AuthenticationError('Account is temporarily locked. Please try again later.');
      }

      // Validate password
      const isValid = await user.comparePassword(password);
      
      if (!isValid) {
        // Increment failed attempts
        await user.incrementLoginAttempts();
        throw new AuthenticationError('Invalid credentials');
      }

      // Reset failed attempts on successful login
      await user.resetLoginAttempts();

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      this.logger.info('User authenticated successfully', {
        userId: user.id,
        email: user.email
      });

      // Return user without sensitive data
      const { password: pwd, mfaSecret, ...userWithoutSensitive } = user.toObject();
      return userWithoutSensitive as IUser;

    } catch (error) {
      this.logger.error('Authentication failed', { error, email });
      throw error;
    }
  }

  /**
   * Updates user MFA settings with encryption
   */
  public async updateMFASettings(
    userId: string,
    mfaEnabled: boolean,
    mfaSecret?: string
  ): Promise<void> {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      user.mfaEnabled = mfaEnabled;
      if (mfaSecret) {
        // Encrypt MFA secret before storage
        const encryptedSecret = await this.encryptionService.encrypt(mfaSecret);
        user.mfaSecret = encryptedSecret.data.toString('base64');
      }

      await user.save();

      this.logger.info('MFA settings updated', {
        userId,
        mfaEnabled
      });

    } catch (error) {
      this.logger.error('MFA update failed', { error, userId });
      throw error;
    }
  }

  /**
   * Handles user deletion with secure cleanup
   */
  public async deleteUser(userId: string): Promise<void> {
    try {
      const user = await this.userModel.findByIdAndDelete(userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      this.logger.info('User deleted successfully', { userId });

    } catch (error) {
      this.logger.error('User deletion failed', { error, userId });
      throw error;
    }
  }
}

export default UserRepository;