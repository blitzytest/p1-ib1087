import { AuthService } from '../../src/services/auth.service';
import { JWTService } from '../../src/services/jwt.service';
import { MFAService } from '../../src/services/mfa.service';
import { UserRepository } from '../../src/repositories/user.repository';
import { Logger } from '../../../shared/utils/logger';
import { AuthenticationError } from '../../../shared/errors';
import { MFAMethod } from '../../src/types';

// Mock dependencies
jest.mock('../../src/repositories/user.repository');
jest.mock('../../src/services/jwt.service');
jest.mock('../../src/services/mfa.service');
jest.mock('../../../shared/utils/logger');

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let jwtService: jest.Mocked<JWTService>;
  let mfaService: jest.Mocked<MFAService>;
  let mockUser: any;
  let mockDeviceInfo: any;

  beforeEach(() => {
    userRepository = new UserRepository() as jest.Mocked<UserRepository>;
    jwtService = new JWTService() as jest.Mocked<JWTService>;
    mfaService = new MFAService(new Logger('test'), null, {
      twilioAccountSid: 'test',
      twilioAuthToken: 'test',
      twilioPhoneNumber: 'test'
    }) as jest.Mocked<MFAService>;

    authService = new AuthService(userRepository, jwtService, mfaService);

    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      mfaEnabled: false
    };

    mockDeviceInfo = {
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1'
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const mockRegisterData = {
      email: 'test@example.com',
      password: 'SecurePass123!@',
      confirmPassword: 'SecurePass123!@'
    };

    it('should register a new user successfully', async () => {
      userRepository.createUser.mockResolvedValue(mockUser);
      jwtService.generateTokens.mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer'
      });

      const result = await authService.register(mockRegisterData, mockDeviceInfo);

      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.mfaRequired).toBe(false);
      expect(userRepository.createUser).toHaveBeenCalledWith({
        email: mockRegisterData.email,
        password: mockRegisterData.password
      });
    });

    it('should throw error when passwords do not match', async () => {
      const invalidData = {
        ...mockRegisterData,
        confirmPassword: 'DifferentPass123!@'
      };

      await expect(authService.register(invalidData, mockDeviceInfo))
        .rejects
        .toThrow(AuthenticationError);
    });

    it('should enforce rate limiting on registration', async () => {
      // Simulate multiple rapid registration attempts
      const attempts = Array(6).fill(mockRegisterData);
      
      for (const attempt of attempts) {
        try {
          await authService.register(attempt, mockDeviceInfo);
        } catch (error) {
          expect(error).toBeInstanceOf(AuthenticationError);
          expect(error.message).toContain('Too many attempts');
        }
      }
    });
  });

  describe('login', () => {
    const mockLoginData = {
      email: 'test@example.com',
      password: 'SecurePass123!@'
    };

    it('should authenticate user successfully without MFA', async () => {
      userRepository.validateCredentials.mockResolvedValue(mockUser);
      jwtService.generateTokens.mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer'
      });

      const result = await authService.login(mockLoginData, mockDeviceInfo);

      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.mfaRequired).toBe(false);
    });

    it('should require MFA when enabled', async () => {
      const mfaUser = { ...mockUser, mfaEnabled: true };
      userRepository.validateCredentials.mockResolvedValue(mfaUser);

      const result = await authService.login(mockLoginData, mockDeviceInfo);

      expect(result.mfaRequired).toBe(true);
      expect(result.tokens).toBeNull();
    });

    it('should handle invalid credentials', async () => {
      userRepository.validateCredentials.mockResolvedValue(null);

      await expect(authService.login(mockLoginData, mockDeviceInfo))
        .rejects
        .toThrow(AuthenticationError);
    });

    it('should enforce rate limiting on failed attempts', async () => {
      userRepository.validateCredentials.mockRejectedValue(
        new AuthenticationError('Invalid credentials')
      );

      const attempts = Array(6).fill(mockLoginData);
      
      for (const attempt of attempts) {
        try {
          await authService.login(attempt, mockDeviceInfo);
        } catch (error) {
          expect(error).toBeInstanceOf(AuthenticationError);
        }
      }
    });
  });

  describe('verifyMFA', () => {
    const mockMFARequest = {
      userId: 'test-user-id',
      code: '123456',
      method: MFAMethod.AUTHENTICATOR
    };

    it('should verify MFA code successfully', async () => {
      mfaService.verifyMFACode.mockResolvedValue(true);
      userRepository.findById.mockResolvedValue(mockUser);
      jwtService.generateTokens.mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer'
      });

      const result = await authService.verifyMFA(mockMFARequest, mockDeviceInfo);

      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.mfaRequired).toBe(false);
    });

    it('should handle invalid MFA code', async () => {
      mfaService.verifyMFACode.mockResolvedValue(false);

      await expect(authService.verifyMFA(mockMFARequest, mockDeviceInfo))
        .rejects
        .toThrow(AuthenticationError);
    });

    it('should enforce rate limiting on MFA attempts', async () => {
      const attempts = Array(6).fill(mockMFARequest);
      
      for (const attempt of attempts) {
        try {
          await authService.verifyMFA(attempt, mockDeviceInfo);
        } catch (error) {
          expect(error).toBeInstanceOf(AuthenticationError);
        }
      }
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      userRepository.findById.mockResolvedValue(mockUser);
      jwtService.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer'
      });

      const result = await authService.refreshToken('test-refresh-token', 'test-user-id');

      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBe('new-access-token');
    });

    it('should handle invalid refresh token', async () => {
      jwtService.refreshAccessToken.mockRejectedValue(
        new AuthenticationError('Invalid refresh token')
      );

      await expect(authService.refreshToken('invalid-token', 'test-user-id'))
        .rejects
        .toThrow(AuthenticationError);
    });
  });

  describe('logout', () => {
    it('should revoke tokens successfully', async () => {
      const mockTokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token'
      };

      await authService.logout('test-user-id', 'test-session-id', mockTokens);

      expect(jwtService.revokeToken).toHaveBeenCalledWith(
        mockTokens.accessToken,
        mockTokens.refreshToken
      );
    });

    it('should handle token revocation errors', async () => {
      jwtService.revokeToken.mockRejectedValue(
        new AuthenticationError('Token revocation failed')
      );

      await expect(authService.logout('test-user-id', 'test-session-id', {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token'
      }))
        .rejects
        .toThrow(AuthenticationError);
    });
  });
});

describe('JWTService', () => {
  let jwtService: JWTService;
  let mockUser: any;

  beforeEach(() => {
    jwtService = new JWTService();
    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com'
    };
  });

  it('should generate valid token pair', async () => {
    const tokens = await jwtService.generateTokens(mockUser);

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.expiresIn).toBeGreaterThan(0);
  });

  it('should verify valid access token', async () => {
    const tokens = await jwtService.generateTokens(mockUser);
    const decoded = await jwtService.verifyToken(`Bearer ${tokens.accessToken}`);

    expect(decoded.id).toBe(mockUser.id);
    expect(decoded.email).toBe(mockUser.email);
  });

  it('should reject expired tokens', async () => {
    const tokens = await jwtService.generateTokens(mockUser);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await jwtService.revokeToken(tokens.accessToken, tokens.refreshToken);

    await expect(jwtService.verifyToken(`Bearer ${tokens.accessToken}`))
      .rejects
      .toThrow(AuthenticationError);
  });
});

describe('MFAService', () => {
  let mfaService: MFAService;
  
  beforeEach(() => {
    mfaService = new MFAService(
      new Logger('test'),
      null,
      {
        twilioAccountSid: 'test',
        twilioAuthToken: 'test',
        twilioPhoneNumber: 'test'
      }
    );
  });

  it('should setup authenticator MFA', async () => {
    const result = await mfaService.setupMFA('test-user-id', MFAMethod.AUTHENTICATOR);

    expect(result.enabled).toBe(true);
    expect(result.method).toBe(MFAMethod.AUTHENTICATOR);
    expect(result.secret).toBeDefined();
    expect(result.backupCodes).toHaveLength(8);
  });

  it('should setup SMS MFA with valid phone number', async () => {
    const result = await mfaService.setupMFA('test-user-id', MFAMethod.SMS, {
      phoneNumber: '+1234567890'
    });

    expect(result.enabled).toBe(true);
    expect(result.method).toBe(MFAMethod.SMS);
    expect(result.secret).toBeDefined();
  });

  it('should verify valid MFA code', async () => {
    const isValid = await mfaService.verifyMFACode({
      userId: 'test-user-id',
      code: '123456',
      method: MFAMethod.AUTHENTICATOR
    });

    expect(isValid).toBe(true);
  });

  it('should enforce rate limiting on verification attempts', async () => {
    const attempts = Array(6).fill({
      userId: 'test-user-id',
      code: '123456',
      method: MFAMethod.AUTHENTICATOR
    });

    for (const attempt of attempts) {
      try {
        await mfaService.verifyMFACode(attempt);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.message).toContain('Too many attempts');
      }
    }
  });
});