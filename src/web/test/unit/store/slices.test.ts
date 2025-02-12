import { configureStore } from '@reduxjs/toolkit';
import { waitFor } from '@testing-library/react';
import authReducer, {
  login,
  verifyMfa,
  refreshSession,
  logout,
  handleSecurityEvent
} from '../../../src/store/slices/authSlice';
import accountsReducer, {
  fetchAccounts,
  linkAccount,
  syncAccountData,
  handleSyncError
} from '../../../src/store/slices/accountsSlice';
import budgetsReducer, {
  fetchBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  trackBudgetProgress
} from '../../../src/store/slices/budgetsSlice';

// Mock services
jest.mock('../../../src/services/api/auth', () => ({
  login: jest.fn(),
  verifyMfa: jest.fn(),
  refreshToken: jest.fn(),
  validateSession: jest.fn()
}));

jest.mock('../../../src/services/api/accounts', () => ({
  getAccounts: jest.fn(),
  linkPlaidAccount: jest.fn(),
  syncAccount: jest.fn()
}));

jest.mock('../../../src/services/api/budgets', () => ({
  getBudgets: jest.fn(),
  createBudget: jest.fn(),
  updateBudget: jest.fn(),
  deleteBudget: jest.fn(),
  getBudgetProgress: jest.fn()
}));

describe('Authentication Slice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authReducer
      }
    });
  });

  describe('Login Flow', () => {
    const mockCredentials = {
      email: 'test@example.com',
      password: 'Test123!@#'
    };

    const mockDeviceInfo = {
      deviceId: 'test-device',
      fingerprint: 'test-fingerprint'
    };

    test('should handle successful login with security logging', async () => {
      const mockResponse = {
        success: true,
        data: {
          accessToken: 'test-token',
          refreshToken: 'refresh-token',
          mfaRequired: false
        }
      };

      (require('../../../src/services/api/auth').login as jest.Mock).mockResolvedValue(mockResponse);

      await store.dispatch(login(mockCredentials, mockDeviceInfo));
      const state = store.getState().auth;

      expect(state.accessToken).toBe('test-token');
      expect(state.refreshToken).toBe('refresh-token');
      expect(state.securityEvents).toContainEqual(
        expect.objectContaining({
          type: 'login_success'
        })
      );
    });

    test('should enforce MFA when required', async () => {
      const mockResponse = {
        success: true,
        data: {
          mfaRequired: true,
          mfaToken: 'mfa-token'
        }
      };

      (require('../../../src/services/api/auth').login as jest.Mock).mockResolvedValue(mockResponse);

      await store.dispatch(login(mockCredentials, mockDeviceInfo));
      const state = store.getState().auth;

      expect(state.mfaRequired).toBe(true);
      expect(state.mfaToken).toBe('mfa-token');
    });

    test('should handle invalid credentials securely', async () => {
      const mockError = {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      };

      (require('../../../src/services/api/auth').login as jest.Mock).mockRejectedValue(mockError);

      await store.dispatch(login(mockCredentials, mockDeviceInfo)).catch(() => {});
      const state = store.getState().auth;

      expect(state.error.code).toBe('INVALID_CREDENTIALS');
      expect(state.securityEvents).toContainEqual(
        expect.objectContaining({
          type: 'login_failure'
        })
      );
    });
  });

  describe('Session Management', () => {
    test('should handle session refresh', async () => {
      const mockResponse = {
        success: true,
        data: {
          accessToken: 'new-token',
          refreshToken: 'new-refresh-token'
        }
      };

      (require('../../../src/services/api/auth').refreshToken as jest.Mock).mockResolvedValue(mockResponse);

      await store.dispatch(refreshSession());
      const state = store.getState().auth;

      expect(state.accessToken).toBe('new-token');
      expect(state.lastActivity).toBeTruthy();
    });

    test('should handle session timeout', async () => {
      const mockError = {
        code: 'SESSION_EXPIRED',
        message: 'Session has expired'
      };

      (require('../../../src/services/api/auth').refreshToken as jest.Mock).mockRejectedValue(mockError);

      await store.dispatch(refreshSession()).catch(() => {});
      const state = store.getState().auth;

      expect(state.accessToken).toBeNull();
      expect(state.error.code).toBe('SESSION_EXPIRED');
    });
  });
});

describe('Accounts Slice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        accounts: accountsReducer
      }
    });
  });

  describe('Account Management', () => {
    test('should handle Plaid connection lifecycle', async () => {
      const mockPlaidRequest = {
        publicToken: 'plaid-token',
        institutionId: 'inst-123',
        accountIds: ['acc-123']
      };

      const mockResponse = {
        success: true,
        data: {
          id: 'acc-123',
          name: 'Test Account',
          type: 'CHECKING'
        }
      };

      (require('../../../src/services/api/accounts').linkPlaidAccount as jest.Mock).mockResolvedValue(mockResponse);

      await store.dispatch(linkAccount(mockPlaidRequest));
      const state = store.getState().accounts;

      expect(state.entities['acc-123']).toBeTruthy();
      expect(state.error).toBeNull();
    });

    test('should track sync progress', async () => {
      const accountId = 'acc-123';
      const mockResponse = {
        success: true,
        data: {
          id: accountId,
          lastSync: new Date().toISOString()
        }
      };

      (require('../../../src/services/api/accounts').syncAccount as jest.Mock).mockResolvedValue(mockResponse);

      await store.dispatch(syncAccountData(accountId));
      const state = store.getState().accounts;

      expect(state.syncProgress[accountId].status).toBe('idle');
      expect(state.syncProgress[accountId].progress).toBe(100);
    });

    test('should recover from sync errors', async () => {
      const accountId = 'acc-123';
      const mockError = {
        code: 'SYNC_ERROR',
        message: 'Failed to sync account'
      };

      (require('../../../src/services/api/accounts').syncAccount as jest.Mock).mockRejectedValue(mockError);

      await store.dispatch(syncAccountData(accountId)).catch(() => {});
      const state = store.getState().accounts;

      expect(state.syncProgress[accountId].status).toBe('error');
      expect(state.error).toBeTruthy();
    });
  });
});

describe('Budgets Slice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        budgets: budgetsReducer
      }
    });
  });

  describe('Budget Management', () => {
    test('should create budget with validation', async () => {
      const mockBudget = {
        category: 'Groceries',
        amount: 500,
        period: 'MONTHLY',
        alertThreshold: 80
      };

      const mockResponse = {
        success: true,
        data: {
          id: 'budget-123',
          ...mockBudget
        }
      };

      (require('../../../src/services/api/budgets').createBudget as jest.Mock).mockResolvedValue(mockResponse);

      await store.dispatch(createBudget(mockBudget));
      const state = store.getState().budgets;

      expect(state.budgets).toContainEqual(expect.objectContaining(mockBudget));
      expect(state.error).toBeNull();
    });

    test('should track real-time progress', async () => {
      const budgetId = 'budget-123';
      const mockProgress = {
        spent: 400,
        remaining: 100,
        trend: {
          direction: 'up',
          rate: 0.15
        }
      };

      (require('../../../src/services/api/budgets').getBudgetProgress as jest.Mock).mockResolvedValue({
        success: true,
        data: mockProgress
      });

      await store.dispatch(trackBudgetProgress(budgetId));
      const state = store.getState().budgets;

      expect(state.budgetProgress[budgetId].spent).toBe(400);
      expect(state.budgetProgress[budgetId].trend.direction).toBe('up');
    });

    test('should manage alert thresholds', async () => {
      const budgetId = 'budget-123';
      const mockBudget = {
        id: budgetId,
        amount: 500,
        alertThreshold: 80
      };

      const mockProgress = {
        spent: 450,
        remaining: 50
      };

      store = configureStore({
        reducer: {
          budgets: budgetsReducer
        },
        preloadedState: {
          budgets: {
            budgets: [mockBudget],
            budgetProgress: {
              [budgetId]: mockProgress
            }
          }
        }
      });

      await waitFor(() => {
        const state = store.getState().budgets;
        expect(state.alertStates[budgetId].triggered).toBe(true);
      });
    });
  });
});