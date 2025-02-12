import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { mockApi } from '../mocks/api';
import { 
  getAccounts, 
  linkPlaidAccount, 
  syncAccount, 
  removeAccount,
  createManualAccount 
} from '../../src/services/api/accounts';
import { Account, AccountType, AccountStatus } from '../../src/types/models';
import { PlaidLinkRequest } from '../../src/types/api';
import { PERFORMANCE_THRESHOLDS } from '../../src/config/constants';

describe('Account API Integration Tests', () => {
  // Test timeout configuration based on performance requirements
  jest.setTimeout(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME * 2);

  beforeEach(() => {
    // Reset mock API state before each test
    mockApi.clearMocks();
  });

  afterEach(() => {
    // Clean up after each test
    jest.clearAllMocks();
  });

  test('getAccounts should retrieve all user accounts', async () => {
    // Mock successful account list response
    const mockAccounts: Account[] = [
      {
        id: 'test-account-1',
        userId: 'test-user-1',
        plaidAccountId: 'plaid-test-1',
        name: 'Test Checking',
        type: AccountType.CHECKING,
        balance: 1000.00,
        currency: 'USD',
        lastSync: new Date(),
        status: AccountStatus.ACTIVE,
        institution: {
          id: 'test-inst-1',
          name: 'Test Bank',
          logo: 'https://test-bank.com/logo.png'
        }
      }
    ];

    mockApi.getMockResponse('accounts').mockResolvedValueOnce({
      success: true,
      data: mockAccounts,
      error: null,
      timestamp: new Date(),
      version: '1.0.0'
    });

    const response = await getAccounts();

    expect(response.success).toBe(true);
    expect(response.data).toHaveLength(1);
    expect(response.data[0].type).toBe(AccountType.CHECKING);
    expect(response.data[0].status).toBe(AccountStatus.ACTIVE);
  });

  test('linkPlaidAccount should connect new account with valid token', async () => {
    const plaidRequest: PlaidLinkRequest = {
      publicToken: 'test-public-token',
      institutionId: 'test-institution',
      accountIds: ['test-account'],
      metadata: {
        institution: {
          name: 'Test Bank',
          id: 'test-inst-1'
        },
        accounts: [{
          id: 'test-account',
          name: 'Test Checking',
          type: 'checking',
          subtype: null
        }]
      }
    };

    const mockLinkedAccount: Account = {
      id: 'new-account-1',
      userId: 'test-user-1',
      plaidAccountId: 'plaid-new-1',
      name: 'Test Checking',
      type: AccountType.CHECKING,
      balance: 0.00,
      currency: 'USD',
      lastSync: new Date(),
      status: AccountStatus.ACTIVE,
      institution: {
        id: 'test-inst-1',
        name: 'Test Bank',
        logo: 'https://test-bank.com/logo.png'
      }
    };

    mockApi.getMockResponse('linkAccount').mockResolvedValueOnce({
      success: true,
      data: mockLinkedAccount,
      error: null,
      timestamp: new Date(),
      version: '1.0.0'
    });

    const startTime = Date.now();
    const response = await linkPlaidAccount(plaidRequest);
    const endTime = Date.now();

    // Verify performance requirements
    expect(endTime - startTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
    expect(response.success).toBe(true);
    expect(response.data.plaidAccountId).toBe('plaid-new-1');
    expect(response.data.status).toBe(AccountStatus.ACTIVE);
  });

  test('syncAccount should update account data within time limit', async () => {
    const accountId = 'test-account-1';
    const mockSyncedAccount: Account = {
      id: accountId,
      userId: 'test-user-1',
      plaidAccountId: 'plaid-test-1',
      name: 'Test Checking',
      type: AccountType.CHECKING,
      balance: 1500.00, // Updated balance
      currency: 'USD',
      lastSync: new Date(),
      status: AccountStatus.ACTIVE,
      institution: {
        id: 'test-inst-1',
        name: 'Test Bank',
        logo: 'https://test-bank.com/logo.png'
      }
    };

    mockApi.getMockResponse('accounts').mockResolvedValueOnce({
      success: true,
      data: mockSyncedAccount,
      error: null,
      timestamp: new Date(),
      version: '1.0.0'
    });

    const startTime = Date.now();
    const response = await syncAccount(accountId);
    const endTime = Date.now();

    // Verify sync completes within 30 seconds per requirements
    expect(endTime - startTime).toBeLessThan(30000);
    expect(response.success).toBe(true);
    expect(response.data.lastSync).toBeDefined();
    expect(response.data.balance).toBe(1500.00);
  });

  test('createManualAccount should add valid manual account', async () => {
    const manualAccountDetails = {
      name: 'Test Manual Account',
      type: AccountType.SAVINGS,
      balance: 5000.00,
      currency: 'USD',
      status: AccountStatus.ACTIVE,
      institution: {
        id: 'manual',
        name: 'Manual Entry',
        logo: 'https://mintclone.com/manual-logo.png'
      }
    };

    const mockManualAccount: Account = {
      ...manualAccountDetails,
      id: 'manual-1',
      userId: 'test-user-1',
      plaidAccountId: '',
      lastSync: new Date()
    };

    mockApi.getMockResponse('accounts').mockResolvedValueOnce({
      success: true,
      data: mockManualAccount,
      error: null,
      timestamp: new Date(),
      version: '1.0.0'
    });

    const response = await createManualAccount(manualAccountDetails);

    expect(response.success).toBe(true);
    expect(response.data.type).toBe(AccountType.SAVINGS);
    expect(response.data.plaidAccountId).toBe('');
  });

  test('removeAccount should delete account and related data', async () => {
    const accountId = 'test-account-1';

    mockApi.getMockResponse('accounts').mockResolvedValueOnce({
      success: true,
      data: null,
      error: null,
      timestamp: new Date(),
      version: '1.0.0'
    });

    const response = await removeAccount(accountId);

    expect(response.success).toBe(true);
    expect(response.data).toBeNull();
    expect(response.error).toBeNull();
  });

  test('linkPlaidAccount should handle connection failures', async () => {
    const plaidRequest: PlaidLinkRequest = {
      publicToken: 'invalid-token',
      institutionId: 'test-institution',
      accountIds: ['test-account'],
      metadata: {
        institution: {
          name: 'Test Bank',
          id: 'test-inst-1'
        },
        accounts: [{
          id: 'test-account',
          name: 'Test Checking',
          type: 'checking',
          subtype: null
        }]
      }
    };

    mockApi.getMockResponse('linkAccount').mockResolvedValueOnce({
      success: false,
      data: null,
      error: {
        code: 'PLAID_ERROR',
        message: 'Failed to link account',
        details: { errorCode: 'INVALID_TOKEN' }
      },
      timestamp: new Date(),
      version: '1.0.0'
    });

    const response = await linkPlaidAccount(plaidRequest);

    expect(response.success).toBe(false);
    expect(response.error.code).toBe('PLAID_ERROR');
    expect(response.data).toBeNull();
  });

  test('syncAccount should handle timeout scenarios', async () => {
    const accountId = 'test-account-1';

    mockApi.getMockResponse('accounts').mockRejectedValueOnce(new Error('Request timeout'));

    const response = await syncAccount(accountId);

    expect(response.success).toBe(false);
    expect(response.error.code).toBe('ACCOUNT_SYNC_ERROR');
    expect(response.data).toBeNull();
  });
});