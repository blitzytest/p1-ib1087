import { 
  Repository,
  EntityRepository,
  getRepository,
  QueryFailedError,
  Transaction,
  TransactionManager,
  EntityManager,
  LessThanOrEqual,
  Between
} from 'typeorm'; // ^0.3.0

import { Logger, createLogger, format, transports } from 'winston'; // ^3.8.0

import { Account, AccountType, AccountStatus } from '../models/account.model';
import { IAccount } from '../../../shared/interfaces';

/**
 * Interface for pagination options
 */
interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Interface for paginated accounts response
 */
interface PaginatedAccounts {
  data: Account[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Repository class for handling account-related database operations
 * Implements comprehensive error handling and sync status tracking
 */
@EntityRepository(Account)
export class AccountRepository extends Repository<Account> {
  private logger: Logger;
  private static readonly SYNC_RETRY_LIMIT = 3;
  private static readonly SYNC_TIMEOUT_MINUTES = 15;

  constructor() {
    super();
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'account-repository-error.log', level: 'error' })
      ]
    });
  }

  /**
   * Finds an account by ID with version checking
   * @param id Account ID
   * @returns Promise<Account | null>
   */
  async findById(id: string): Promise<Account | null> {
    try {
      const account = await this.findOne({
        where: { id },
        select: ['id', 'userId', 'name', 'type', 'status', 'balance', 'currency', 'lastSync', 'version']
      });

      if (!account) {
        this.logger.debug(`Account not found: ${id}`);
        return null;
      }

      return account;
    } catch (error) {
      this.logger.error('Error finding account by ID', {
        error,
        accountId: id
      });
      throw error;
    }
  }

  /**
   * Finds all accounts for a user with pagination
   * @param userId User ID
   * @param options Pagination options
   * @returns Promise<PaginatedAccounts>
   */
  async findByUserId(
    userId: string,
    options: PaginationOptions
  ): Promise<PaginatedAccounts> {
    try {
      const [accounts, total] = await this.findAndCount({
        where: { userId },
        skip: (options.page - 1) * options.limit,
        take: options.limit,
        order: {
          lastSync: 'DESC'
        }
      });

      return {
        data: accounts,
        total,
        page: options.page,
        limit: options.limit
      };
    } catch (error) {
      this.logger.error('Error finding accounts by user ID', {
        error,
        userId
      });
      throw error;
    }
  }

  /**
   * Creates a new account with comprehensive validation
   * @param accountData Account creation data
   * @returns Promise<Account>
   */
  @Transaction()
  async create(
    @TransactionManager() manager: EntityManager,
    accountData: IAccount
  ): Promise<Account> {
    try {
      // Check for existing account with same Plaid ID
      const existingAccount = await manager.findOne(Account, {
        where: { plaidAccountId: accountData.plaidAccountId }
      });

      if (existingAccount) {
        throw new Error('Account already exists with this Plaid ID');
      }

      const account = manager.create(Account, {
        ...accountData,
        status: AccountStatus.ACTIVE,
        lastSync: new Date(),
        version: 1
      });

      // Validate account data
      if (!account.validateBalance(account.balance)) {
        throw new Error('Invalid account balance');
      }

      const savedAccount = await manager.save(account);
      
      this.logger.info('Account created successfully', {
        accountId: savedAccount.id,
        userId: savedAccount.userId
      });

      return savedAccount;
    } catch (error) {
      this.logger.error('Error creating account', {
        error,
        accountData
      });
      throw error;
    }
  }

  /**
   * Updates account balance with sync status tracking
   * @param id Account ID
   * @param balance New balance
   * @param status Sync status
   * @returns Promise<Account>
   */
  @Transaction()
  async updateBalance(
    @TransactionManager() manager: EntityManager,
    id: string,
    balance: number,
    status: AccountStatus
  ): Promise<Account> {
    try {
      const account = await manager.findOne(Account, {
        where: { id },
        lock: { mode: 'pessimistic_write' }
      });

      if (!account) {
        throw new Error('Account not found');
      }

      if (!account.validateBalance(balance)) {
        throw new Error('Invalid balance value');
      }

      // Update account with sync tracking
      account.balance = balance;
      account.status = status;
      account.lastSync = new Date();
      account.version += 1;

      // Handle sync retry logic
      if (status === AccountStatus.ERROR) {
        const syncAttempts = await this.countSyncAttempts(id);
        if (syncAttempts >= AccountRepository.SYNC_RETRY_LIMIT) {
          account.status = AccountStatus.INACTIVE;
          this.logger.warn('Account sync retry limit reached', { accountId: id });
        }
      }

      const updatedAccount = await manager.save(account);

      this.logger.info('Account balance updated', {
        accountId: id,
        newBalance: balance,
        status
      });

      return updatedAccount;
    } catch (error) {
      this.logger.error('Error updating account balance', {
        error,
        accountId: id
      });
      throw error;
    }
  }

  /**
   * Counts recent sync attempts for retry limiting
   * @param accountId Account ID
   * @returns Promise<number>
   */
  private async countSyncAttempts(accountId: string): Promise<number> {
    const timeWindow = new Date();
    timeWindow.setMinutes(timeWindow.getMinutes() - AccountRepository.SYNC_TIMEOUT_MINUTES);

    const attempts = await this.count({
      where: {
        id: accountId,
        status: AccountStatus.ERROR,
        lastSync: Between(timeWindow, new Date())
      }
    });

    return attempts;
  }
}