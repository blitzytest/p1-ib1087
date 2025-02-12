import { renderHook, act } from '@testing-library/react-hooks'; // ^8.0.1
import { Provider } from 'react-redux'; // ^8.0.0
import { configureStore } from '@reduxjs/toolkit';
import { useAccounts } from '../../../src/hooks/useAccounts';
import { mockApi } from '../../mocks/api';
import { Account, AccountStatus, AccountType } from '../../../src/types/models';
import accountsReducer from '../../../src/store/slices/accountsSlice';
import { PERFORMANCE_THRESHOLDS } from '../../../src/config/constants';

// Mock store setup
const createTestStore = () => {
  return configureStore({
    reducer: {
      accounts: accountsReducer
    }
  });
};

// Mock data
const mockAccount: Account = {
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
    id: 'test-bank-1',
    name: 'Test Bank',
    logo: 'https://test-bank.com/logo.png'
  }
};

describe('useAccounts', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
    mockApi.clearMocks();
  });

  it('should fetch accounts successfully', async () => {
    // Setup mock response
    mockApi.getMockResponse('accounts').mockResolvedValueOnce({
      success: true,
      data: [mockAccount],
      error: null,
      timestamp: new Date(),
      version: '1.0.0'
    });

    const { result, waitForNextUpdate } = renderHook(() => useAccounts(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
    });

    // Initial state
    expect(result.current.loading).toBe(true);
    expect(result.current.accounts).toEqual([]);
    expect(result.current.error).toBeNull();

    // Wait for fetch to complete
    await waitForNextUpdate();

    // Verify successful fetch
    expect(result.current.loading).toBe(false);
    expect(result.current.accounts).toHaveLength(1);
    expect(result.current.accounts[0]).toEqual(mockAccount);
    expect(result.current.error).toBeNull();
  });

  it('should handle account linking process', async () => {
    const plaidLinkRequest = {
      publicToken: 'test-public-token',
      institutionId: 'test-institution',
      accountIds: ['test-account'],
      metadata: {
        institution: {
          name: 'Test Bank',
          id: 'test-bank-1'
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
      success: true,
      data: mockAccount,
      error: null,
      timestamp: new Date(),
      version: '1.0.0'
    });

    const { result, waitForNextUpdate } = renderHook(() => useAccounts(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
    });

    await act(async () => {
      result.current.linkAccount(plaidLinkRequest);
      await waitForNextUpdate();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.accounts).toContainEqual(mockAccount);
  });

  it('should handle account sync within performance threshold', async () => {
    const startTime = Date.now();
    mockApi.getMockResponse('sync').mockResolvedValueOnce({
      success: true,
      data: { ...mockAccount, balance: 1500.00 },
      error: null,
      timestamp: new Date(),
      version: '1.0.0'
    });

    const { result, waitForNextUpdate } = renderHook(() => useAccounts(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
    });

    await act(async () => {
      result.current.syncAccount(mockAccount.id);
      await waitForNextUpdate();
    });

    const syncDuration = Date.now() - startTime;
    expect(syncDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
    expect(result.current.error).toBeNull();
  });

  it('should handle API errors gracefully', async () => {
    const errorResponse = {
      success: false,
      data: null,
      error: {
        code: 'ACCOUNT_SYNC_ERROR',
        message: 'Failed to sync account',
        details: {}
      },
      timestamp: new Date(),
      version: '1.0.0'
    };

    mockApi.getMockResponse('accounts').mockRejectedValueOnce(errorResponse);

    const { result, waitForNextUpdate } = renderHook(() => useAccounts(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
    });

    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toEqual({
      message: 'Failed to fetch accounts',
      code: 'FETCH_ERROR',
      retry: expect.any(Function)
    });
  });

  it('should handle retry mechanism for failed operations', async () => {
    mockApi.getMockResponse('accounts')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        success: true,
        data: [mockAccount],
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      });

    const { result, waitForNextUpdate } = renderHook(() => useAccounts(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
    });

    // Wait for initial failure
    await waitForNextUpdate();
    expect(result.current.error).toBeTruthy();

    // Attempt retry
    await act(async () => {
      if (result.current.error?.retry) {
        await result.current.error.retry();
      }
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.accounts).toHaveLength(1);
  });

  it('should prevent concurrent sync operations', async () => {
    mockApi.getMockResponse('sync').mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 1000))
    );

    const { result } = renderHook(() => useAccounts(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
    });

    await act(async () => {
      // Attempt multiple sync operations
      const sync1 = result.current.syncAccount(mockAccount.id);
      const sync2 = result.current.syncAccount(mockAccount.id);

      await Promise.all([sync1, sync2]);
    });

    // Verify only one sync operation was processed
    expect(mockApi.getMockResponse('sync')).toHaveBeenCalledTimes(1);
  });

  it('should cleanup resources on unmount', () => {
    const { unmount } = renderHook(() => useAccounts(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
    });

    unmount();
    // Verify cleanup (no memory leaks or pending operations)
    expect(mockApi.getMockResponse('sync')).not.toHaveBeenCalled();
  });
});