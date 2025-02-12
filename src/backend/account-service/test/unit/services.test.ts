import { AccountService } from '../../src/services/account.service';
import { AccountRepository } from '../../src/repositories/account.repository';
import { PlaidService } from '../../src/services/plaid.service';
import { Logger } from '../../../shared/utils/logger';
import { AccountError } from '../../../shared/errors';
import { Account, AccountType, AccountStatus } from '../../src/models/account.model';
import { MetricsService } from '@company/metrics';

// Mock implementations
jest.mock('../../src/repositories/account.repository');
jest.mock('../../src/services/plaid.service');
jest.mock('../../../shared/utils/logger');
jest.mock('@company/metrics');

describe('AccountService', () => {
  let accountService: AccountService;
  let mockAccountRepository: jest.Mocked<AccountRepository>;
  let mockPlaidService: jest.Mocked<PlaidService>;
  let mockLogger: jest.Mocked<Logger>;
  let mockMetricsService: jest.Mocked<MetricsService>;

  const testUserId = 'test-user-123';
  const testAccountId = 'test-account-456';
  const testPlaidToken = 'test-plaid-token';

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Initialize mocks
    mockAccountRepository = new AccountRepository() as jest.Mocked<AccountRepository>;
    mockPlaidService = new PlaidService({
      plaidClientId: 'test',
      plaidSecret: 'test',
      plaidEnv: 'sandbox',
      webhookUrl: 'test'
    }, null, null) as jest.Mocked<PlaidService>;
    mockLogger = new Logger('test') as jest.Mocked<Logger>;
    mockMetricsService = new MetricsService() as jest.Mocked<MetricsService>;

    // Create service instance
    accountService = new AccountService(
      mockAccountRepository,
      mockPlaidService,
      mockMetricsService,
      mockLogger
    );
  });

  describe('createManualAccount', () => {
    const validAccountData = {
      name: 'Test Account',
      type: AccountType.CHECKING,
      balance: 1000,
      currency: 'USD'
    };

    it('should create a manual account successfully', async () => {
      const mockAccount = {
        id: testAccountId,
        userId: testUserId,
        ...validAccountData,
        status: AccountStatus.ACTIVE,
        lastSync: expect.any(Date),
        plaidAccountId: '',
        plaidAccessToken: ''
      };

      mockAccountRepository.findByUserId.mockResolvedValue({ 
        data: [], 
        total: 0, 
        page: 1, 
        limit: 1 
      });
      mockAccountRepository.create.mockResolvedValue(mockAccount as Account);

      const result = await accountService.createManualAccount(testUserId, validAccountData);

      expect(result).toEqual(mockAccount);
      expect(mockAccountRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: testUserId,
        ...validAccountData
      }));
      expect(mockMetricsService.incrementGauge).toHaveBeenCalledWith('accounts_per_user', { userId: testUserId });
    });

    it('should throw error when account limit is reached', async () => {
      mockAccountRepository.findByUserId.mockResolvedValue({ 
        data: [], 
        total: 50, 
        page: 1, 
        limit: 1 
      });

      await expect(accountService.createManualAccount(testUserId, validAccountData))
        .rejects
        .toThrow(AccountError);
    });

    it('should validate account data', async () => {
      const invalidAccountData = {
        ...validAccountData,
        balance: NaN
      };

      await expect(accountService.createManualAccount(testUserId, invalidAccountData))
        .rejects
        .toThrow('Invalid account data');
    });
  });

  describe('linkPlaidAccount', () => {
    const mockPlaidAccounts = [{
      plaidAccountId: 'plaid-123',
      name: 'Plaid Account',
      type: AccountType.CHECKING,
      balance: 2000,
      currency: 'USD'
    }];

    it('should link Plaid accounts successfully', async () => {
      const encryptedToken = 'encrypted-token';
      mockPlaidService.exchangePublicToken.mockResolvedValue(encryptedToken);
      mockPlaidService.getAccounts.mockResolvedValue(mockPlaidAccounts);
      mockAccountRepository.create.mockImplementation(async (data) => ({
        ...data,
        id: testAccountId
      } as Account));

      const result = await accountService.linkPlaidAccount(testUserId, testPlaidToken);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: testUserId,
        plaidAccountId: mockPlaidAccounts[0].plaidAccountId,
        plaidAccessToken: encryptedToken
      });
      expect(mockPlaidService.exchangePublicToken).toHaveBeenCalledWith(testPlaidToken);
    });

    it('should handle Plaid API errors', async () => {
      mockPlaidService.exchangePublicToken.mockRejectedValue(new Error('Plaid API error'));

      await expect(accountService.linkPlaidAccount(testUserId, testPlaidToken))
        .rejects
        .toThrow('Plaid API error');
      expect(mockMetricsService.incrementCounter).toHaveBeenCalledWith('account_sync_errors');
    });

    it('should monitor sync performance', async () => {
      const encryptedToken = 'encrypted-token';
      mockPlaidService.exchangePublicToken.mockResolvedValue(encryptedToken);
      mockPlaidService.getAccounts.mockResolvedValue(mockPlaidAccounts);
      mockAccountRepository.create.mockImplementation(async (data) => ({
        ...data,
        id: testAccountId
      } as Account));

      await accountService.linkPlaidAccount(testUserId, testPlaidToken);

      expect(mockMetricsService.setGauge).toHaveBeenCalledWith(
        'account_sync_duration',
        expect.any(Number)
      );
    });
  });

  describe('syncAccount', () => {
    const mockAccount = {
      id: testAccountId,
      userId: testUserId,
      plaidAccountId: 'plaid-123',
      plaidAccessToken: 'encrypted-token',
      balance: 1000,
      status: AccountStatus.ACTIVE
    };

    const mockPlaidAccount = {
      plaidAccountId: 'plaid-123',
      balance: 1500
    };

    it('should sync account successfully', async () => {
      mockAccountRepository.findById.mockResolvedValue(mockAccount as Account);
      mockPlaidService.getAccounts.mockResolvedValue([mockPlaidAccount]);
      mockAccountRepository.updateBalance.mockImplementation(async (id, balance, status) => ({
        ...mockAccount,
        balance,
        status
      } as Account));

      const result = await accountService.syncAccount(testAccountId);

      expect(result.balance).toBe(mockPlaidAccount.balance);
      expect(result.status).toBe(AccountStatus.ACTIVE);
      expect(mockAccountRepository.updateBalance).toHaveBeenCalledWith(
        testAccountId,
        mockPlaidAccount.balance,
        AccountStatus.ACTIVE
      );
    });

    it('should handle non-existent accounts', async () => {
      mockAccountRepository.findById.mockResolvedValue(null);

      await expect(accountService.syncAccount(testAccountId))
        .rejects
        .toThrow('Account not found');
    });

    it('should handle manual accounts', async () => {
      mockAccountRepository.findById.mockResolvedValue({
        ...mockAccount,
        plaidAccountId: ''
      } as Account);

      await expect(accountService.syncAccount(testAccountId))
        .rejects
        .toThrow('Cannot sync manual account');
    });

    it('should handle sync errors', async () => {
      mockAccountRepository.findById.mockResolvedValue(mockAccount as Account);
      mockPlaidService.getAccounts.mockRejectedValue(new Error('Sync failed'));

      await expect(accountService.syncAccount(testAccountId))
        .rejects
        .toThrow('Sync failed');
      expect(mockMetricsService.incrementCounter).toHaveBeenCalledWith('account_sync_errors');
      expect(mockAccountRepository.updateBalance).toHaveBeenCalledWith(
        testAccountId,
        null,
        AccountStatus.ERROR
      );
    });

    it('should enforce sync timeout', async () => {
      jest.useFakeTimers();
      mockAccountRepository.findById.mockResolvedValue(mockAccount as Account);
      mockPlaidService.getAccounts.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve([mockPlaidAccount]), 31000);
      }));

      const syncPromise = accountService.syncAccount(testAccountId);
      jest.advanceTimersByTime(31000);

      await expect(syncPromise).resolves.toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Account sync exceeded timeout',
        expect.any(Object)
      );
      
      jest.useRealTimers();
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });
});