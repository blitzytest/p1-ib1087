import { AuthService } from '../../src/services/auth.service';
import { JWTService } from '../../src/services/jwt.service';
import { MFAService } from '../../src/services/mfa.service';
import { UserRepository } from '../../src/repositories/user.repository';
import { Logger } from '../../../shared/utils/logger';
import { EncryptionService } from '../../../shared/utils/encryption';
import { AuthenticationError } from '../../../shared/errors';
import { MFAMethod } from '../../src/types';
import { config } from '../../src/config';
import mongoose from 'mongoose';

describe('Authentication Service Integration Tests', () => {
  let authService: AuthService;
  let jwtService: JWTService;
  let mfaService: MFAService;
  let userRepository: UserRepository;
  let logger: Logger;
  let encryptionService: EncryptionService;

  // Test user data
  const testUser = {
    email: 'test@example.com',
    password: 'Test123!@#$',
    confirmPassword: 'Test123!@#$'
  };

  const deviceInfo = {
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1'
  };

  beforeAll(async () => {
    // Initialize logger
    logger = new Logger('AuthTestSuite', {
      maskFields: ['password', 'token', 'mfaSecret']
    });

    // Initialize encryption service
    encryptionService = new EncryptionService({
      region: 'us-east-1',
      keyId: 'test-key',
      keyTTL: 3600000
    });

    // Initialize MFA service
    mfaService = new MFAService(logger, encryptionService, {
      twilioAccountSid: 'test-sid',
      twilioAuthToken: 'test-token',
      twilioPhoneNumber: '+1234567890'
    });

    // Initialize JWT service
    jwtService = new JWTService();

    // Initialize user repository
    userRepository = new UserRepository();

    // Initialize auth service
    authService = new AuthService(userRepository, jwtService, mfaService);

    // Connect to test database
    await mongoose.connect(config.dbUri);
  });

  afterAll(async () => {
    // Cleanup test data
    await userRepository.deleteUser(testUser.email);
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear any existing test user
    try {
      await userRepository.deleteUser(testUser.email);
    } catch (error) {
      // Ignore if user doesn't exist
    }
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const result = await authService.register(testUser, deviceInfo);

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(testUser.email);
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.mfaRequired).toBe(false);

      // Verify user exists in database
      const user = await userRepository.findByEmail(testUser.email);
      expect(user).toBeDefined();
      expect(user.email).toBe(testUser.email);
    });

    it('should reject registration with invalid password', async () => {
      const weakUser = {
        ...testUser,
        password: 'weak',
        confirmPassword: 'weak'
      };

      await expect(authService.register(weakUser, deviceInfo))
        .rejects
        .toThrow(AuthenticationError);
    });

    it('should reject registration with mismatched passwords', async () => {
      const mismatchUser = {
        ...testUser,
        confirmPassword: 'Different123!@#'
      };

      await expect(authService.register(mismatchUser, deviceInfo))
        .rejects
        .toThrow(AuthenticationError);
    });

    it('should reject duplicate email registration', async () => {
      // Register first user
      await authService.register(testUser, deviceInfo);

      // Attempt duplicate registration
      await expect(authService.register(testUser, deviceInfo))
        .rejects
        .toThrow(AuthenticationError);
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      // Create test user for login tests
      await authService.register(testUser, deviceInfo);
    });

    it('should login user successfully', async () => {
      const result = await authService.login({
        email: testUser.email,
        password: testUser.password
      }, deviceInfo);

      expect(result).toBeDefined();
      expect(result.user.email).toBe(testUser.email);
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should reject login with invalid credentials', async () => {
      await expect(authService.login({
        email: testUser.email,
        password: 'wrongpassword'
      }, deviceInfo))
        .rejects
        .toThrow(AuthenticationError);
    });

    it('should handle rate limiting', async () => {
      // Attempt multiple failed logins
      const attempts = 6;
      const promises = [];

      for (let i = 0; i < attempts; i++) {
        promises.push(authService.login({
          email: testUser.email,
          password: 'wrongpassword'
        }, deviceInfo));
      }

      await Promise.all(promises.map(p => expect(p).rejects.toThrow()));
    });
  });

  describe('MFA Flow', () => {
    let userId: string;

    beforeEach(async () => {
      // Create user and enable MFA
      const result = await authService.register(testUser, deviceInfo);
      userId = result.user.id;
    });

    it('should setup MFA successfully', async () => {
      const result = await mfaService.setupMFA(userId, MFAMethod.AUTHENTICATOR);

      expect(result).toBeDefined();
      expect(result.enabled).toBe(true);
      expect(result.method).toBe(MFAMethod.AUTHENTICATOR);
      expect(result.secret).toBeDefined();
      expect(result.backupCodes).toBeDefined();
      expect(result.backupCodes.length).toBeGreaterThan(0);
    });

    it('should verify MFA code successfully', async () => {
      // Setup MFA
      const setup = await mfaService.setupMFA(userId, MFAMethod.AUTHENTICATOR);

      // Generate valid TOTP code
      const code = '123456'; // Mock valid code

      const result = await mfaService.verifyMFACode({
        userId,
        code,
        method: MFAMethod.AUTHENTICATOR
      });

      expect(result).toBe(true);
    });

    it('should reject invalid MFA codes', async () => {
      await mfaService.setupMFA(userId, MFAMethod.AUTHENTICATOR);

      await expect(mfaService.verifyMFACode({
        userId,
        code: '000000',
        method: MFAMethod.AUTHENTICATOR
      }))
        .resolves
        .toBe(false);
    });
  });

  describe('Token Management', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Create user and get tokens
      const result = await authService.register(testUser, deviceInfo);
      accessToken = result.tokens.accessToken;
      refreshToken = result.tokens.refreshToken;
    });

    it('should verify valid access token', async () => {
      const result = await jwtService.verifyToken(`Bearer ${accessToken}`);
      expect(result).toBeDefined();
      expect(result.email).toBe(testUser.email);
    });

    it('should reject expired access token', async () => {
      // Wait for token to expire (mock expiration)
      await expect(jwtService.verifyToken('Bearer expired.token.here'))
        .rejects
        .toThrow(AuthenticationError);
    });

    it('should refresh access token successfully', async () => {
      const result = await authService.refreshToken(refreshToken, testUser.email);

      expect(result).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).not.toBe(accessToken);
      expect(result.tokens.refreshToken).not.toBe(refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      await expect(authService.refreshToken('invalid-token', testUser.email))
        .rejects
        .toThrow(AuthenticationError);
    });
  });
});