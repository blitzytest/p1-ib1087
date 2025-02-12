import { injectable } from 'inversify';
import { BadRequestError } from 'routing-controllers';
import { RateLimiter } from 'rate-limiter-flexible';
import { MetricsService } from '@company/metrics';

import { Account, AccountType, AccountStatus } from '../models/account.model';
import { AccountRepository } from '../repositories/account.repository';
import { PlaidService } from './plaid.service';
import { Logger } from '../../../shared/utils/logger';
import { AccountError } from '../../../shared/errors';

interface AccountCreateDTO {
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
}

@injectable()
export class AccountService {
  private readonly rateLimiter: RateLimiter;
  private static readonly SYNC_TIMEOUT = 30000; // 30 seconds
  private static readonly MAX_ACCOUNTS_PER_USER = 50;

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly plaidService: PlaidService,
    private readonly metricsService: MetricsService,
    private readonly logger: Logger
  ) {
    // Initialize rate limiter for API calls
    this.rateLimiter = new RateLimiter({
      points: 100,
      duration: 60,
      blockDuration: 60
    });

    this.logger = new Logger('AccountService');
    this.initializeMetrics();
  }

  /**
   * Initializes performance metrics monitoring
   */
  private initializeMetrics(): void {
    this.metricsService.registerGauge('account_sync_duration', 'Account sync duration in ms');
    this.metricsService.registerCounter('account_sync_errors', 'Account sync error count');
    this.metricsService.registerGauge('accounts_per_user', 'Number of accounts per user');
  }

  /**
   * Creates a manual financial account with validation
   */
  public async createManualAccount(
    userId: string,
    accountData: AccountCreateDTO
  ): Promise<Account> {
    try {
      await this.rateLimiter.consume(userId);

      // Validate account creation
      const isValid = await this.validateAccountData(accountData);
      if (!isValid) {
        throw new BadRequestError('Invalid account data');
      }

      // Check account limit
      const userAccounts = await this.accountRepository.findByUserId(userId, { page: 1, limit: 1 });
      if (userAccounts.total >= AccountService.MAX_ACCOUNTS_PER_USER) {
        throw new AccountError('Maximum number of accounts reached');
      }

      const account = await this.accountRepository.create({
        userId,
        name: accountData.name,
        type: accountData.type,
        balance: accountData.balance,
        currency: accountData.currency,
        status: AccountStatus.ACTIVE,
        lastSync: new Date(),
        plaidAccountId: '', // Empty for manual accounts
        plaidAccessToken: ''
      });

      this.logger.info('Manual account created', {
        accountId: account.id,
        userId,
        type: accountData.type
      });

      this.metricsService.incrementGauge('accounts_per_user', { userId });

      return account;
    } catch (error) {
      this.logger.error('Failed to create manual account', { error, userId });
      throw error;
    }
  }

  /**
   * Links a financial institution account via Plaid
   */
  public async linkPlaidAccount(
    userId: string,
    publicToken: string
  ): Promise<Account[]> {
    const startTime = Date.now();
    try {
      await this.rateLimiter.consume(userId);

      // Exchange public token for access token
      const encryptedAccessToken = await this.plaidService.exchangePublicToken(publicToken);

      // Get accounts from Plaid
      const plaidAccounts = await this.plaidService.getAccounts(encryptedAccessToken);

      // Create accounts in database
      const accounts: Account[] = [];
      for (const plaidAccount of plaidAccounts) {
        const account = await this.accountRepository.create({
          userId,
          plaidAccountId: plaidAccount.plaidAccountId,
          plaidAccessToken: encryptedAccessToken,
          name: plaidAccount.name,
          type: plaidAccount.type as AccountType,
          balance: plaidAccount.balance,
          currency: plaidAccount.currency,
          status: AccountStatus.ACTIVE,
          lastSync: new Date()
        });
        accounts.push(account);
      }

      this.logger.info('Plaid accounts linked', {
        userId,
        accountCount: accounts.length
      });

      await this.monitorSyncPerformance(accounts[0].id, startTime);
      return accounts;
    } catch (error) {
      this.logger.error('Failed to link Plaid accounts', { error, userId });
      this.metricsService.incrementCounter('account_sync_errors');
      throw error;
    }
  }

  /**
   * Synchronizes account data with financial institution
   */
  public async syncAccount(accountId: string): Promise<Account> {
    const startTime = Date.now();
    try {
      const account = await this.accountRepository.findById(accountId);
      if (!account) {
        throw new AccountError('Account not found');
      }

      if (!account.plaidAccountId) {
        throw new AccountError('Cannot sync manual account');
      }

      // Update account status to syncing
      await this.accountRepository.updateBalance(
        accountId,
        account.balance,
        AccountStatus.SYNCING
      );

      // Get latest account data from Plaid
      const plaidAccounts = await this.plaidService.getAccounts(account.plaidAccessToken);
      const plaidAccount = plaidAccounts.find(a => a.plaidAccountId === account.plaidAccountId);

      if (!plaidAccount) {
        throw new AccountError('Account not found in Plaid');
      }

      // Update account with latest data
      const updatedAccount = await this.accountRepository.updateBalance(
        accountId,
        plaidAccount.balance,
        AccountStatus.ACTIVE
      );

      await this.monitorSyncPerformance(accountId, startTime);
      return updatedAccount;
    } catch (error) {
      await this.handleSyncError(accountId, error);
      throw error;
    }
  }

  /**
   * Validates account data for manual accounts
   */
  private async validateAccountData(accountData: AccountCreateDTO): Promise<boolean> {
    if (!accountData.name || accountData.name.length < 1 || accountData.name.length > 100) {
      return false;
    }

    if (!Object.values(AccountType).includes(accountData.type)) {
      return false;
    }

    if (typeof accountData.balance !== 'number' || isNaN(accountData.balance)) {
      return false;
    }

    if (!accountData.currency || accountData.currency.length !== 3) {
      return false;
    }

    return true;
  }

  /**
   * Handles synchronization errors with retry logic
   */
  private async handleSyncError(accountId: string, error: Error): Promise<void> {
    this.logger.error('Account sync error', { error, accountId });
    this.metricsService.incrementCounter('account_sync_errors');

    try {
      await this.accountRepository.updateBalance(
        accountId,
        null,
        AccountStatus.ERROR
      );
    } catch (updateError) {
      this.logger.error('Failed to update account status', { updateError, accountId });
    }
  }

  /**
   * Monitors and records sync operation performance
   */
  private async monitorSyncPerformance(accountId: string, startTime: number): Promise<void> {
    const duration = Date.now() - startTime;
    this.metricsService.setGauge('account_sync_duration', duration);

    if (duration > AccountService.SYNC_TIMEOUT) {
      this.logger.warn('Account sync exceeded timeout', {
        accountId,
        duration,
        timeout: AccountService.SYNC_TIMEOUT
      });
    }
  }
}