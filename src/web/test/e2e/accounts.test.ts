import { render, fireEvent, waitFor } from '@testing-library/react-native'; // ^12.0.0
import { setupJestConfig } from '../setup';
import { mockApi } from '../mocks/api';
import { mockUseNavigation } from '../mocks/navigation';
import { AccountType, AccountStatus } from '../../src/types';

// Configure test environment
setupJestConfig();

describe('Accounts E2E Tests', () => {
  // Mock data for tests
  const mockAccounts = [
    {
      id: 'acc-1',
      userId: 'user-1',
      plaidAccountId: 'plaid-1',
      name: 'Chase Checking',
      type: AccountType.CHECKING,
      balance: 5000.00,
      currency: 'USD',
      lastSync: new Date(),
      status: AccountStatus.ACTIVE,
      institution: {
        id: 'inst-1',
        name: 'Chase',
        logo: 'https://chase.com/logo.png'
      }
    },
    {
      id: 'acc-2',
      userId: 'user-1',
      plaidAccountId: 'plaid-2',
      name: 'Vanguard Investment',
      type: AccountType.INVESTMENT,
      balance: 150000.00,
      currency: 'USD',
      lastSync: new Date(),
      status: AccountStatus.ACTIVE,
      institution: {
        id: 'inst-2',
        name: 'Vanguard',
        logo: 'https://vanguard.com/logo.png'
      }
    }
  ];

  beforeEach(() => {
    // Reset mocks and navigation state
    jest.clearAllMocks();
    mockApi.clearMocks();
    mockUseNavigation();
  });

  describe('Account Listing', () => {
    it('should display accounts with correct formatting and accessibility labels', async () => {
      // Mock API response
      mockApi.getMockResponse('accounts').mockResolvedValueOnce({
        success: true,
        data: mockAccounts,
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      });

      // Render component
      const { getByTestId, getAllByRole, queryByTestId } = render(
        <AccountsListScreen testID="accounts-screen" />
      );

      // Verify loading state
      expect(getByTestId('loading-spinner')).toBeTruthy();

      // Wait for accounts to load
      await waitFor(() => {
        expect(queryByTestId('loading-spinner')).toBeNull();
      });

      // Verify accounts are displayed
      const accountCards = getAllByRole('button');
      expect(accountCards).toHaveLength(2);

      // Verify accessibility
      expect(accountCards[0]).toHaveAccessibilityLabel('Chase Checking account, Balance: $5,000.00');
      expect(accountCards[1]).toHaveAccessibilityLabel('Vanguard Investment account, Balance: $150,000.00');

      // Verify responsive layout
      const container = getByTestId('accounts-list-container');
      expect(container).toHaveStyle({
        paddingHorizontal: expect.any(Number),
        marginBottom: expect.any(Number)
      });
    });

    it('should handle empty account state correctly', async () => {
      // Mock empty accounts response
      mockApi.getMockResponse('accounts').mockResolvedValueOnce({
        success: true,
        data: [],
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      });

      const { getByText, getByTestId } = render(
        <AccountsListScreen testID="accounts-screen" />
      );

      await waitFor(() => {
        expect(getByText('No accounts found')).toBeTruthy();
        expect(getByTestId('add-account-button')).toBeTruthy();
      });
    });

    it('should handle error states and provide retry mechanism', async () => {
      // Mock error response
      mockApi.getMockResponse('accounts').mockRejectedValueOnce({
        success: false,
        data: null,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch accounts'
        },
        timestamp: new Date(),
        version: '1.0.0'
      });

      const { getByText, getByTestId } = render(
        <AccountsListScreen testID="accounts-screen" />
      );

      await waitFor(() => {
        expect(getByText('Failed to fetch accounts')).toBeTruthy();
        expect(getByTestId('retry-button')).toBeTruthy();
      });

      // Test retry functionality
      mockApi.getMockResponse('accounts').mockResolvedValueOnce({
        success: true,
        data: mockAccounts,
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      });

      fireEvent.press(getByTestId('retry-button'));

      await waitFor(() => {
        expect(getByTestId('accounts-list-container')).toBeTruthy();
      });
    });
  });

  describe('Account Linking', () => {
    it('should successfully complete Plaid linking flow', async () => {
      const { getByTestId, getByText } = render(
        <AddAccountScreen testID="add-account-screen" />
      );

      // Verify initial state
      expect(getByText('Connect Your Bank')).toBeTruthy();

      // Mock Plaid link success
      mockApi.getMockResponse('linkAccount').mockResolvedValueOnce({
        success: true,
        data: true,
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      });

      // Trigger Plaid link
      fireEvent.press(getByTestId('plaid-link-button'));

      await waitFor(() => {
        expect(mockApi.getMockResponse('linkAccount')).toHaveBeenCalledWith(
          expect.objectContaining({
            publicToken: expect.any(String),
            institutionId: expect.any(String),
            accountIds: expect.any(Array)
          })
        );
      });

      // Verify success state
      expect(getByText('Account Connected Successfully')).toBeTruthy();
    });

    it('should handle Plaid link errors gracefully', async () => {
      const { getByTestId, getByText } = render(
        <AddAccountScreen testID="add-account-screen" />
      );

      // Mock Plaid link error
      mockApi.getMockResponse('linkAccount').mockRejectedValueOnce({
        success: false,
        data: null,
        error: {
          code: 'LINK_ERROR',
          message: 'Institution connection failed'
        },
        timestamp: new Date(),
        version: '1.0.0'
      });

      // Trigger Plaid link
      fireEvent.press(getByTestId('plaid-link-button'));

      await waitFor(() => {
        expect(getByText('Institution connection failed')).toBeTruthy();
        expect(getByTestId('retry-link-button')).toBeTruthy();
      });
    });
  });

  describe('Account Sync', () => {
    it('should sync account data within 30 second requirement', async () => {
      const startTime = Date.now();
      
      // Mock sync response with progress updates
      mockApi.getMockResponse('syncAccount').mockResolvedValueOnce({
        success: true,
        data: {
          status: 'completed',
          updatedAccounts: mockAccounts
        },
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      });

      const { getByTestId } = render(
        <AccountsListScreen testID="accounts-screen" />
      );

      // Trigger sync
      fireEvent.press(getByTestId('sync-button'));

      await waitFor(() => {
        expect(getByTestId('sync-success-indicator')).toBeTruthy();
      });

      const syncDuration = Date.now() - startTime;
      expect(syncDuration).toBeLessThan(30000);
    });

    it('should handle sync failures with retry mechanism', async () => {
      // Mock sync failure
      mockApi.getMockResponse('syncAccount').mockRejectedValueOnce({
        success: false,
        data: null,
        error: {
          code: 'SYNC_ERROR',
          message: 'Sync failed'
        },
        timestamp: new Date(),
        version: '1.0.0'
      });

      const { getByTestId, getByText } = render(
        <AccountsListScreen testID="accounts-screen" />
      );

      // Trigger sync
      fireEvent.press(getByTestId('sync-button'));

      await waitFor(() => {
        expect(getByText('Sync failed')).toBeTruthy();
        expect(getByTestId('retry-sync-button')).toBeTruthy();
      });

      // Mock successful retry
      mockApi.getMockResponse('syncAccount').mockResolvedValueOnce({
        success: true,
        data: {
          status: 'completed',
          updatedAccounts: mockAccounts
        },
        error: null,
        timestamp: new Date(),
        version: '1.0.0'
      });

      // Trigger retry
      fireEvent.press(getByTestId('retry-sync-button'));

      await waitFor(() => {
        expect(getByTestId('sync-success-indicator')).toBeTruthy();
      });
    });
  });
});