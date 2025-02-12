import { JsonController, Get, Post, Put, Delete, Body, Param, Authorized, HeaderParam } from 'routing-controllers'; // ^0.10.0
import { injectable } from 'inversify'; // ^6.0.1
import { OpenAPI, ResponseSchema, SecurityRequirements } from 'routing-controllers-openapi'; // ^4.0.0
import CircuitBreaker from 'opossum'; // ^6.0.0
import { MetricsService } from '@app/metrics'; // ^1.0.0

import { AccountService } from '../services/account.service';
import { validateAccountCreation, validateAccountUpdate } from '../validation/account.validation';
import { Logger } from '../../../shared/utils/logger';
import { AccountError } from '../../../shared/errors';
import { IAccount } from '../../../shared/interfaces';

@injectable()
@JsonController('/accounts')
@OpenAPI({ security: [{ BearerAuth: [] }] })
export class AccountController {
  private readonly plaidCircuitBreaker: CircuitBreaker;
  private static readonly SYNC_TIMEOUT = 30000; // 30 seconds

  constructor(
    private readonly accountService: AccountService,
    private readonly logger: Logger,
    private readonly metricsService: MetricsService
  ) {
    this.logger = new Logger('AccountController');
    
    // Configure circuit breaker for Plaid API calls
    this.plaidCircuitBreaker = new CircuitBreaker(this.accountService.syncAccount, {
      timeout: AccountController.SYNC_TIMEOUT,
      resetTimeout: 30000,
      errorThresholdPercentage: 50,
      volumeThreshold: 3
    });

    this.initializeMetrics();
    this.setupCircuitBreakerHandlers();
  }

  private initializeMetrics(): void {
    this.metricsService.registerHistogram('account_operation_duration', 'Account operation duration');
    this.metricsService.registerCounter('account_errors', 'Account operation errors');
    this.metricsService.registerGauge('active_accounts', 'Number of active accounts');
  }

  private setupCircuitBreakerHandlers(): void {
    this.plaidCircuitBreaker.on('open', () => {
      this.logger.warn('Circuit breaker opened for Plaid API calls');
    });

    this.plaidCircuitBreaker.on('halfOpen', () => {
      this.logger.info('Circuit breaker half-open, attempting reset');
    });

    this.plaidCircuitBreaker.on('close', () => {
      this.logger.info('Circuit breaker closed, Plaid API calls resumed');
    });
  }

  @Post('/link/token')
  @Authorized()
  @ResponseSchema(LinkTokenResponse)
  @OpenAPI({ summary: 'Generate Plaid Link token' })
  async createLinkToken(
    @HeaderParam('x-user-id') userId: string,
    @HeaderParam('x-correlation-id') correlationId: string
  ): Promise<{ linkToken: string; expiresIn: number }> {
    const startTime = Date.now();
    try {
      this.logger.info('Creating Plaid Link token', { userId, correlationId });

      const linkToken = await this.accountService.createLinkToken(userId);
      
      this.metricsService.recordHistogram(
        'account_operation_duration',
        Date.now() - startTime
      );

      return {
        linkToken,
        expiresIn: 3600 // 1 hour expiration
      };
    } catch (error) {
      this.handleError('Failed to create link token', error, { userId, correlationId });
      throw error;
    }
  }

  @Post('/link')
  @Authorized()
  @ResponseSchema(AccountResponse)
  @OpenAPI({ summary: 'Link financial account' })
  async linkAccount(
    @HeaderParam('x-user-id') userId: string,
    @HeaderParam('x-correlation-id') correlationId: string,
    @Body() linkData: { publicToken: string }
  ): Promise<IAccount[]> {
    const startTime = Date.now();
    try {
      this.logger.info('Linking financial account', { userId, correlationId });

      const accounts = await this.accountService.linkPlaidAccount(
        userId,
        linkData.publicToken
      );

      this.metricsService.incrementGauge('active_accounts', accounts.length);
      this.metricsService.recordHistogram(
        'account_operation_duration',
        Date.now() - startTime
      );

      return accounts;
    } catch (error) {
      this.handleError('Failed to link account', error, { userId, correlationId });
      throw error;
    }
  }

  @Get()
  @Authorized()
  @ResponseSchema(AccountsResponse)
  @OpenAPI({ summary: 'Get user accounts' })
  async getAccounts(
    @HeaderParam('x-user-id') userId: string,
    @HeaderParam('x-correlation-id') correlationId: string,
    @HeaderParam('x-page') page: number = 1,
    @HeaderParam('x-limit') limit: number = 10
  ): Promise<{ accounts: IAccount[]; total: number }> {
    const startTime = Date.now();
    try {
      this.logger.info('Retrieving user accounts', { userId, correlationId, page, limit });

      const result = await this.accountService.getUserAccounts(userId, { page, limit });

      this.metricsService.recordHistogram(
        'account_operation_duration',
        Date.now() - startTime
      );

      return result;
    } catch (error) {
      this.handleError('Failed to retrieve accounts', error, { userId, correlationId });
      throw error;
    }
  }

  @Get('/:id')
  @Authorized()
  @ResponseSchema(AccountResponse)
  @OpenAPI({ summary: 'Get account by ID' })
  async getAccountById(
    @Param('id') accountId: string,
    @HeaderParam('x-user-id') userId: string,
    @HeaderParam('x-correlation-id') correlationId: string
  ): Promise<IAccount> {
    const startTime = Date.now();
    try {
      this.logger.info('Retrieving account details', { accountId, userId, correlationId });

      const account = await this.accountService.getAccountById(accountId, userId);
      if (!account) {
        throw new AccountError('Account not found');
      }

      this.metricsService.recordHistogram(
        'account_operation_duration',
        Date.now() - startTime
      );

      return account;
    } catch (error) {
      this.handleError('Failed to retrieve account', error, { accountId, userId, correlationId });
      throw error;
    }
  }

  @Put('/:id/sync')
  @Authorized()
  @ResponseSchema(AccountResponse)
  @OpenAPI({ summary: 'Sync account data' })
  async syncAccount(
    @Param('id') accountId: string,
    @HeaderParam('x-user-id') userId: string,
    @HeaderParam('x-correlation-id') correlationId: string
  ): Promise<IAccount> {
    const startTime = Date.now();
    try {
      this.logger.info('Syncing account data', { accountId, userId, correlationId });

      const account = await this.plaidCircuitBreaker.fire(accountId);

      this.metricsService.recordHistogram(
        'account_operation_duration',
        Date.now() - startTime
      );

      return account;
    } catch (error) {
      this.handleError('Failed to sync account', error, { accountId, userId, correlationId });
      throw error;
    }
  }

  @Delete('/:id')
  @Authorized()
  @ResponseSchema(SuccessResponse)
  @OpenAPI({ summary: 'Delete account' })
  async deleteAccount(
    @Param('id') accountId: string,
    @HeaderParam('x-user-id') userId: string,
    @HeaderParam('x-correlation-id') correlationId: string
  ): Promise<{ success: boolean }> {
    const startTime = Date.now();
    try {
      this.logger.info('Deleting account', { accountId, userId, correlationId });

      await this.accountService.deleteAccount(accountId, userId);

      this.metricsService.decrementGauge('active_accounts');
      this.metricsService.recordHistogram(
        'account_operation_duration',
        Date.now() - startTime
      );

      return { success: true };
    } catch (error) {
      this.handleError('Failed to delete account', error, { accountId, userId, correlationId });
      throw error;
    }
  }

  private handleError(message: string, error: Error, context: object): void {
    this.logger.error(message, { error, ...context });
    this.metricsService.incrementCounter('account_errors');
    
    if (error instanceof AccountError) {
      throw error;
    }
    throw new AccountError(message);
  }
}