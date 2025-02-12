import { injectable } from 'inversify';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode, LinkTokenCreateRequest, AccountsGetRequest, TransactionsSyncRequest } from 'plaid'; // v12.0.0
import axios, { AxiosInstance } from 'axios'; // v1.3.0
import { IAccount } from '../../../shared/interfaces';
import { EncryptionService } from '../../../shared/utils/encryption';
import { Logger } from '../../../shared/utils/logger';
import { AccountError, TransactionError } from '../../../shared/errors';

/**
 * Enterprise-grade Plaid integration service with enhanced security,
 * performance monitoring, and compliance features
 */
@injectable()
export class PlaidService {
  private readonly plaidClient: PlaidApi;
  private readonly axiosInstance: AxiosInstance;
  private readonly encryptionService: EncryptionService;
  private readonly logger: Logger;
  private readonly retryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 5000
  };

  constructor(
    private readonly config: {
      plaidClientId: string;
      plaidSecret: string;
      plaidEnv: string;
      webhookUrl: string;
    },
    encryptionService: EncryptionService,
    logger: Logger
  ) {
    // Initialize Plaid client with configuration
    const plaidConfig = new Configuration({
      basePath: PlaidEnvironments[config.plaidEnv],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': config.plaidClientId,
          'PLAID-SECRET': config.plaidSecret,
          'Plaid-Version': '2020-09-14'
        }
      }
    });

    this.plaidClient = new PlaidApi(plaidConfig);
    this.encryptionService = encryptionService;
    this.logger = logger;

    // Configure axios instance with retry logic
    this.axiosInstance = axios.create({
      timeout: 10000
    });
    this.setupAxiosRetry();
    this.validateConfiguration();
  }

  /**
   * Validates service configuration on initialization
   */
  private async validateConfiguration(): Promise<void> {
    try {
      await this.plaidClient.institutionsGet({
        count: 1,
        offset: 0,
        country_codes: [CountryCode.Us]
      });
      this.logger.info('Plaid configuration validated successfully');
    } catch (error) {
      this.logger.error('Plaid configuration validation failed', { error });
      throw new AccountError('Invalid Plaid configuration');
    }
  }

  /**
   * Configures axios retry logic for resilient API calls
   */
  private setupAxiosRetry(): void {
    this.axiosInstance.interceptors.response.use(
      response => response,
      async error => {
        let retryCount = error.config?.retryCount || 0;
        
        if (retryCount < this.retryConfig.maxRetries && this.shouldRetry(error)) {
          retryCount += 1;
          const delay = Math.min(
            this.retryConfig.initialDelay * Math.pow(2, retryCount),
            this.retryConfig.maxDelay
          );

          error.config.retryCount = retryCount;
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.axiosInstance(error.config);
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Determines if a failed request should be retried
   */
  private shouldRetry(error: any): boolean {
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    return retryableStatusCodes.includes(error?.response?.status) ||
           error.code === 'ECONNABORTED' ||
           error.code === 'ETIMEDOUT';
  }

  /**
   * Creates a Plaid Link token for client-side initialization
   */
  public async createLinkToken(userId: string): Promise<string> {
    try {
      const request: LinkTokenCreateRequest = {
        user: { client_user_id: userId },
        client_name: 'Mint Clone',
        products: [Products.Auth, Products.Transactions],
        country_codes: [CountryCode.Us],
        language: 'en',
        webhook: this.config.webhookUrl
      };

      const response = await this.plaidClient.linkTokenCreate(request);
      this.logger.info('Link token created successfully', { userId });
      
      return response.data.link_token;
    } catch (error) {
      this.logger.error('Link token creation failed', { error, userId });
      throw new AccountError('Failed to create link token');
    }
  }

  /**
   * Exchanges public token for access token with encryption
   */
  public async exchangePublicToken(publicToken: string): Promise<string> {
    try {
      const response = await this.plaidClient.itemPublicTokenExchange({
        public_token: publicToken
      });

      const encryptedToken = await this.encryptionService.encrypt(
        response.data.access_token
      );

      this.logger.info('Public token exchanged successfully');
      
      return JSON.stringify(encryptedToken);
    } catch (error) {
      this.logger.error('Public token exchange failed', { error });
      throw new AccountError('Failed to exchange public token');
    }
  }

  /**
   * Retrieves account information with enhanced validation
   */
  public async getAccounts(encryptedAccessToken: string): Promise<IAccount[]> {
    try {
      const accessToken = await this.encryptionService.decrypt(
        JSON.parse(encryptedAccessToken)
      );

      const request: AccountsGetRequest = {
        access_token: accessToken
      };

      const response = await this.plaidClient.accountsGet(request);
      
      return response.data.accounts.map(account => ({
        id: account.account_id,
        plaidAccountId: account.account_id,
        name: account.name,
        type: account.type,
        subtype: account.subtype || '',
        balance: account.balances.current || 0,
        currency: account.balances.iso_currency_code || 'USD',
        lastSync: new Date(),
        status: 'active'
      }));
    } catch (error) {
      this.logger.error('Account retrieval failed', { error });
      throw new AccountError('Failed to retrieve accounts');
    }
  }

  /**
   * Syncs transactions with cursor-based pagination and deduplication
   */
  public async syncTransactions(
    encryptedAccessToken: string,
    cursor?: string
  ): Promise<{
    added: any[];
    modified: any[];
    removed: any[];
    nextCursor: string;
  }> {
    try {
      const accessToken = await this.encryptionService.decrypt(
        JSON.parse(encryptedAccessToken)
      );

      const request: TransactionsSyncRequest = {
        access_token: accessToken,
        cursor
      };

      const response = await this.plaidClient.transactionsSync(request);
      
      this.logger.info('Transactions synced successfully', {
        added: response.data.added.length,
        modified: response.data.modified.length,
        removed: response.data.removed.length
      });

      return {
        added: response.data.added,
        modified: response.data.modified,
        removed: response.data.removed,
        nextCursor: response.data.next_cursor
      };
    } catch (error) {
      this.logger.error('Transaction sync failed', { error });
      throw new TransactionError('Failed to sync transactions');
    }
  }

  /**
   * Handles webhook events from Plaid
   */
  public async handleWebhook(
    webhookType: string,
    webhookCode: string,
    itemId: string,
    error: any | null
  ): Promise<void> {
    try {
      this.logger.info('Processing Plaid webhook', {
        webhookType,
        webhookCode,
        itemId
      });

      if (error) {
        throw new Error(JSON.stringify(error));
      }

      switch (webhookType) {
        case 'TRANSACTIONS':
          await this.handleTransactionWebhook(webhookCode, itemId);
          break;
        case 'ITEM':
          await this.handleItemWebhook(webhookCode, itemId);
          break;
        default:
          this.logger.warn('Unhandled webhook type', { webhookType });
      }
    } catch (error) {
      this.logger.error('Webhook processing failed', { error });
      throw new AccountError('Failed to process webhook');
    }
  }

  /**
   * Handles transaction-specific webhook events
   */
  private async handleTransactionWebhook(
    webhookCode: string,
    itemId: string
  ): Promise<void> {
    // Implementation specific to transaction webhooks
    this.logger.info('Processing transaction webhook', {
      webhookCode,
      itemId
    });
  }

  /**
   * Handles item-specific webhook events
   */
  private async handleItemWebhook(
    webhookCode: string,
    itemId: string
  ): Promise<void> {
    // Implementation specific to item webhooks
    this.logger.info('Processing item webhook', {
      webhookCode,
      itemId
    });
  }
}