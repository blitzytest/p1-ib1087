import { describe, it, beforeEach, afterEach, jest } from 'jest';
import { expect } from '@jest/globals';
import { createConnection, getConnection, Connection } from 'typeorm';
import { AccountService } from '../../src/services/account.service';
import { Account, AccountType, AccountStatus } from '../../src/models/account.model';
import { AccountRepository } from '../../src/repositories/account.repository';
import { PlaidService } from '../../src/services/plaid.service';
import { EncryptionService } from '../../../shared/utils/encryption';
import { Logger } from '../../../shared/utils/logger';
import { AccountError } from '../../../shared/errors';

describe('AccountService Integration Tests', () => {
  let connection: Connection;
  let accountService: AccountService;
  let accountRepository: AccountRepository;
  let plaidService: PlaidService;
  let encryptionService: EncryptionService;
  let logger: Logger;

  const testUserId = 'test-user-123';
  const testPlaidToken = 'test-plaid-token';
  const testAccessToken = 'test-access-token';

  beforeEach(async () => {
    // Initialize test database connection
    connection = await createConnection({
      type: 'postgres',
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      username: process.env.TEST_DB_USER || 'test',
      password: process.env.TEST_DB_PASSWORD || 'test',
      database: process.env.TEST_DB_NAME || 'mint_clone_test',
      entities: [Account],
      synchronize: true,
      logging: false
    });

    // Initialize dependencies
    logger = new Logger('AccountServiceTest');
    encryptionService = new EncryptionService({
      region: 'us-east-1',
      keyId: 'test-key',
      keyTTL: 3600000
    });

    plaidService = new PlaidService({
      plaidClientId: 'test-client',
      plaidSecret: 'test-secret',
      plaidEnv: 'sandbox',
      webhookUrl: 'http://localhost/webhook'
    }, encryptionService, logger);

    accountRepository = connection.getRepository(Account);
    accountService = new AccountService(accountRepository, plaidService, logger);

    // Clear test data
    await accountRepository.clear();
  });

  afterEach(async () => {
    // Clean up test data and close connection
    await connection.dropDatabase();
    await connection.close();
  });

  describe('createLinkToken', () => {
    it('should create a valid Plaid link token', async () => {
      // Mock Plaid service response
      jest.spyOn(plaidService, 'createLinkToken').mockResolvedValue('test-link-token');

      const linkToken = await accountService.createLinkToken(testUserId);

      expect(linkToken).toBeDefined();
      expect(typeof linkToken).toBe('string');
      expect(linkToken).toBe('test-link-token');
    });

    it('should handle Plaid service errors', async () => {
      jest.spyOn(plaidService, 'createLinkToken').mockRejectedValue(
        new AccountError('Plaid service error')
      );

      await expect(accountService.createLinkToken(testUserId))
        .rejects.toThrow(AccountError);
    });
  });

  describe('linkAccount', () => {
    it('should successfully link a Plaid account', async () => {
      // Mock Plaid responses
      const mockPlaidAccount = {
        plaidAccountId: 'plaid-123',
        name: 'Test Checking',
        type: AccountType.CHECKING,
        balance: 1000,
        currency: 'USD'
      };

      jest.spyOn(plaidService, 'exchangePublicToken')
        .mockResolvedValue(testAccessToken);
      jest.spyOn(plaidService, 'getAccounts')
        .mockResolvedValue([mockPlaidAccount]);

      const accounts = await accountService.linkPlaidAccount(testUserId, testPlaidToken);

      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({
        userId: testUserId,
        name: mockPlaidAccount.name,
        type: mockPlaidAccount.type,
        balance: mockPlaidAccount.balance,
        status: AccountStatus.ACTIVE
      });
    });

    it('should handle duplicate account linking', async () => {
      // Create existing account
      const existingAccount = await accountRepository.create({
        userId: testUserId,
        plaidAccountId: 'plaid-123',
        name: 'Existing Account',
        type: AccountType.CHECKING,
        balance: 1000,
        currency: 'USD',
        status: AccountStatus.ACTIVE,
        lastSync: new Date()
      });

      jest.spyOn(plaidService, 'exchangePublicToken')
        .mockResolvedValue(testAccessToken);
      jest.spyOn(plaidService, 'getAccounts')
        .mockResolvedValue([{
          plaidAccountId: 'plaid-123',
          name: 'Test Account',
          type: AccountType.CHECKING,
          balance: 2000,
          currency: 'USD'
        }]);

      await expect(accountService.linkPlaidAccount(testUserId, testPlaidToken))
        .rejects.toThrow('Account already exists with this Plaid ID');
    });
  });

  describe('syncAccount', () => {
    it('should sync account balance within 30 seconds', async () => {
      // Create test account
      const account = await accountRepository.create({
        userId: testUserId,
        plaidAccountId: 'plaid-123',
        plaidAccessToken: testAccessToken,
        name: 'Test Account',
        type: AccountType.CHECKING,
        balance: 1000,
        currency: 'USD',
        status: AccountStatus.ACTIVE,
        lastSync: new Date()
      });

      jest.spyOn(plaidService, 'getAccounts')
        .mockResolvedValue([{
          plaidAccountId: 'plaid-123',
          name: 'Test Account',
          type: AccountType.CHECKING,
          balance: 1500,
          currency: 'USD'
        }]);

      const startTime = Date.now();
      const updatedAccount = await accountService.syncAccount(account.id);
      const syncTime = Date.now() - startTime;

      expect(syncTime).toBeLessThan(30000); // 30 seconds
      expect(updatedAccount.balance).toBe(1500);
      expect(updatedAccount.status).toBe(AccountStatus.ACTIVE);
      expect(updatedAccount.lastSync).toBeInstanceOf(Date);
    });

    it('should handle sync errors with proper status update', async () => {
      const account = await accountRepository.create({
        userId: testUserId,
        plaidAccountId: 'plaid-123',
        plaidAccessToken: testAccessToken,
        name: 'Test Account',
        type: AccountType.CHECKING,
        balance: 1000,
        currency: 'USD',
        status: AccountStatus.ACTIVE,
        lastSync: new Date()
      });

      jest.spyOn(plaidService, 'getAccounts')
        .mockRejectedValue(new Error('Plaid sync error'));

      await expect(accountService.syncAccount(account.id))
        .rejects.toThrow();

      const failedAccount = await accountRepository.findById(account.id);
      expect(failedAccount?.status).toBe(AccountStatus.ERROR);
    });
  });

  describe('getUserAccounts', () => {
    it('should retrieve paginated user accounts', async () => {
      // Create multiple test accounts
      const accounts = await Promise.all([
        accountRepository.create({
          userId: testUserId,
          name: 'Account 1',
          type: AccountType.CHECKING,
          balance: 1000,
          currency: 'USD',
          status: AccountStatus.ACTIVE,
          lastSync: new Date()
        }),
        accountRepository.create({
          userId: testUserId,
          name: 'Account 2',
          type: AccountType.SAVINGS,
          balance: 2000,
          currency: 'USD',
          status: AccountStatus.ACTIVE,
          lastSync: new Date()
        })
      ]);

      const result = await accountService.getUserAccounts(testUserId, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.data[0].name).toBe('Account 1');
      expect(result.data[1].name).toBe('Account 2');
    });

    it('should filter accounts by type', async () => {
      await Promise.all([
        accountRepository.create({
          userId: testUserId,
          name: 'Checking Account',
          type: AccountType.CHECKING,
          balance: 1000,
          currency: 'USD',
          status: AccountStatus.ACTIVE,
          lastSync: new Date()
        }),
        accountRepository.create({
          userId: testUserId,
          name: 'Savings Account',
          type: AccountType.SAVINGS,
          balance: 2000,
          currency: 'USD',
          status: AccountStatus.ACTIVE,
          lastSync: new Date()
        })
      ]);

      const result = await accountService.getUserAccounts(
        testUserId,
        { page: 1, limit: 10 },
        { type: AccountType.CHECKING }
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe(AccountType.CHECKING);
    });
  });
});