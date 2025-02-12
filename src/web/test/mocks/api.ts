import { jest } from '@jest/globals';
import { ApiResponse, ErrorResponse, LoginRequest, AuthResponse, PlaidLinkRequest, TransactionFilters, BudgetRequest, InvestmentFilters, TimeRange } from '../../src/types/api';
import { User, Account, AccountType, AccountStatus } from '../../src/types/models';

/**
 * Default mock API response delay in milliseconds
 * @constant {number}
 */
const DEFAULT_MOCK_DELAY = 500;

/**
 * Mock API configuration options interface
 */
interface MockApiConfig {
  responseDelay?: number;
  simulateErrors?: boolean;
  errorRate?: number;
}

/**
 * Mock response options interface
 */
interface MockOptions {
  delay?: number;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Mock state management class for maintaining test state
 */
class MockStateManager {
  private state: Map<string, any> = new Map();

  setState(key: string, value: any): void {
    this.state.set(key, value);
  }

  getState(key: string): any {
    return this.state.get(key);
  }

  clearState(): void {
    this.state.clear();
  }
}

/**
 * Mock API service implementation for testing
 * @version 1.0.0
 */
class MockApiService {
  private mockResponses: Map<string, jest.Mock> = new Map();
  private mockState: MockStateManager = new MockStateManager();
  private responseDelay: number;
  private simulateErrors: boolean;
  private errorRate: number;

  constructor(config: MockApiConfig = {}) {
    this.responseDelay = config.responseDelay || DEFAULT_MOCK_DELAY;
    this.simulateErrors = config.simulateErrors || false;
    this.errorRate = config.errorRate || 0.1;
    this.initializeMocks();
  }

  /**
   * Initializes default mock responses for all endpoints
   */
  private initializeMocks(): void {
    // Auth endpoints
    this.mockResponses.set('login', this.createMockAuthResponse());
    this.mockResponses.set('refresh', this.createMockAuthResponse());
    this.mockResponses.set('logout', this.createMockResponse());

    // Account endpoints
    this.mockResponses.set('accounts', this.createMockAccountResponse());
    this.mockResponses.set('linkAccount', this.createMockPlaidResponse());

    // Transaction endpoints
    this.mockResponses.set('transactions', this.createMockTransactionResponse());
    
    // Budget endpoints
    this.mockResponses.set('budgets', this.createMockBudgetResponse());

    // Investment endpoints
    this.mockResponses.set('investments', this.createMockInvestmentResponse());
  }

  /**
   * Creates a mock authentication response
   */
  private createMockAuthResponse(): jest.Mock {
    return jest.fn().mockImplementation(async (request: LoginRequest): Promise<ApiResponse<AuthResponse>> => {
      await this.simulateDelay();

      if (this.shouldSimulateError()) {
        return this.createErrorResponse('AUTH_ERROR', 'Authentication failed');
      }

      return {
        success: true,
        data: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          mfaRequired: false,
          mfaToken: null,
          expiresIn: 3600
        },
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      };
    });
  }

  /**
   * Creates a mock account response
   */
  private createMockAccountResponse(): jest.Mock {
    return jest.fn().mockImplementation(async (): Promise<ApiResponse<Account[]>> => {
      await this.simulateDelay();

      if (this.shouldSimulateError()) {
        return this.createErrorResponse('ACCOUNT_ERROR', 'Failed to fetch accounts');
      }

      const mockAccounts: Account[] = [
        {
          id: 'mock-account-1',
          userId: 'mock-user-1',
          plaidAccountId: 'plaid-mock-1',
          name: 'Mock Checking',
          type: AccountType.CHECKING,
          balance: 5000.00,
          currency: 'USD',
          lastSync: new Date(),
          status: AccountStatus.ACTIVE,
          institution: {
            id: 'mock-inst-1',
            name: 'Mock Bank',
            logo: 'https://mock-bank.com/logo.png'
          }
        }
      ];

      return {
        success: true,
        data: mockAccounts,
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      };
    });
  }

  /**
   * Creates a mock Plaid link response
   */
  private createMockPlaidResponse(): jest.Mock {
    return jest.fn().mockImplementation(async (request: PlaidLinkRequest): Promise<ApiResponse<boolean>> => {
      await this.simulateDelay();

      if (this.shouldSimulateError()) {
        return this.createErrorResponse('PLAID_ERROR', 'Failed to link account');
      }

      return {
        success: true,
        data: true,
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      };
    });
  }

  /**
   * Creates a mock transaction response
   */
  private createMockTransactionResponse(): jest.Mock {
    return jest.fn().mockImplementation(async (filters: TransactionFilters): Promise<ApiResponse<any>> => {
      await this.simulateDelay();

      if (this.shouldSimulateError()) {
        return this.createErrorResponse('TRANSACTION_ERROR', 'Failed to fetch transactions');
      }

      return {
        success: true,
        data: {
          transactions: [],
          totalCount: 0,
          page: filters.page,
          limit: filters.limit
        },
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      };
    });
  }

  /**
   * Creates a mock budget response
   */
  private createMockBudgetResponse(): jest.Mock {
    return jest.fn().mockImplementation(async (request: BudgetRequest): Promise<ApiResponse<any>> => {
      await this.simulateDelay();

      if (this.shouldSimulateError()) {
        return this.createErrorResponse('BUDGET_ERROR', 'Failed to create budget');
      }

      return {
        success: true,
        data: {
          id: 'mock-budget-1',
          ...request
        },
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      };
    });
  }

  /**
   * Creates a mock investment response
   */
  private createMockInvestmentResponse(): jest.Mock {
    return jest.fn().mockImplementation(async (filters: InvestmentFilters): Promise<ApiResponse<any>> => {
      await this.simulateDelay();

      if (this.shouldSimulateError()) {
        return this.createErrorResponse('INVESTMENT_ERROR', 'Failed to fetch investment data');
      }

      return {
        success: true,
        data: {
          portfolio: {
            id: filters.portfolioId,
            value: 50000.00,
            returns: 0.085,
            allocation: {
              stocks: 0.7,
              bonds: 0.2,
              cash: 0.1
            }
          },
          history: []
        },
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      };
    });
  }

  /**
   * Creates a generic mock response
   */
  private createMockResponse(): jest.Mock {
    return jest.fn().mockImplementation(async (): Promise<ApiResponse<any>> => {
      await this.simulateDelay();
      return {
        success: true,
        data: null,
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      };
    });
  }

  /**
   * Creates an error response
   */
  private createErrorResponse(code: string, message: string): ApiResponse<any> {
    const error: ErrorResponse = {
      code,
      message,
      details: {}
    };

    return {
      success: false,
      data: null,
      error,
      timestamp: new Date(),
      version: '1.0.0'
    };
  }

  /**
   * Simulates API response delay
   */
  private async simulateDelay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.responseDelay));
  }

  /**
   * Determines if an error should be simulated
   */
  private shouldSimulateError(): boolean {
    return this.simulateErrors && Math.random() < this.errorRate;
  }

  /**
   * Gets a mock response for an endpoint
   */
  public getMockResponse(endpoint: string): jest.Mock {
    return this.mockResponses.get(endpoint) || this.createMockResponse();
  }

  /**
   * Clears all mock responses and state
   */
  public clearMocks(): void {
    this.mockResponses.clear();
    this.mockState.clearState();
    this.initializeMocks();
  }
}

// Export configured mock API instance
export const mockApi = new MockApiService({
  responseDelay: DEFAULT_MOCK_DELAY,
  simulateErrors: process.env.NODE_ENV === 'test',
  errorRate: 0.1
});

// Export individual mock endpoints for direct access
export const {
  getMockResponse: getMock,
  clearMocks
} = mockApi;