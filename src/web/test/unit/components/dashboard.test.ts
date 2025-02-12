import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { axe } from '@axe-core/react';
import * as testUtils from '@testing-library/react';
import '@testing-library/jest-dom';

import AccountsSummary from '../../src/components/dashboard/AccountsSummary';
import BudgetProgress from '../../src/components/dashboard/BudgetProgress';
import NetWorthCard from '../../src/components/dashboard/NetWorthCard';
import RecentTransactions from '../../src/components/dashboard/RecentTransactions';
import { PERFORMANCE_THRESHOLDS } from '../../src/config/constants';

// Mock data
const mockAccounts = [
  {
    id: '1',
    name: 'Checking',
    type: 'CHECKING',
    balance: 5000,
    currency: 'USD',
    status: 'ACTIVE'
  },
  {
    id: '2',
    name: 'Savings',
    type: 'SAVINGS',
    balance: 10000,
    currency: 'USD',
    status: 'ACTIVE'
  }
];

const mockBudgets = [
  {
    id: '1',
    category: 'Groceries',
    amount: 600,
    spent: 450,
    alertThreshold: 90
  },
  {
    id: '2',
    category: 'Transport',
    amount: 200,
    spent: 180,
    alertThreshold: 90
  }
];

const mockTransactions = [
  {
    id: '1',
    description: 'Walmart',
    amount: -54.23,
    category: 'Groceries',
    date: new Date('2024-01-15')
  },
  {
    id: '2',
    description: 'Chevron',
    amount: -45.00,
    category: 'Transport',
    date: new Date('2024-01-14')
  }
];

// Test setup helper
const setupTest = (initialState = {}, options = {}) => {
  const store = configureStore({
    reducer: {
      accounts: (state = { accounts: mockAccounts }) => state,
      budgets: (state = { budgets: mockBudgets }) => state,
      transactions: (state = { transactions: mockTransactions }) => state
    },
    preloadedState: initialState
  });

  return {
    store,
    ...render(
      <Provider store={store}>
        {options.component}
      </Provider>
    )
  };
};

describe('AccountsSummary Component', () => {
  it('renders account list correctly', () => {
    const { getByText, getAllByRole } = setupTest({}, {
      component: <AccountsSummary showAddButton={true} />
    });

    expect(getByText('Total Balance')).toBeInTheDocument();
    expect(getAllByRole('button')).toHaveLength(mockAccounts.length + 1); // accounts + add button
    expect(getByText('$15,000.00')).toBeInTheDocument(); // Total balance
  });

  it('handles loading state with skeleton loader', () => {
    const { getByTestId } = setupTest({
      accounts: { loading: true }
    }, {
      component: <AccountsSummary />
    });

    expect(getByTestId('skeleton-loader')).toBeInTheDocument();
  });

  it('handles refresh functionality', async () => {
    const onRefresh = jest.fn();
    const { getByTestId } = setupTest({}, {
      component: <AccountsSummary onRefresh={onRefresh} />
    });

    fireEvent.refresh(getByTestId('refresh-control'));
    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it('meets accessibility requirements', async () => {
    const { container } = setupTest({}, {
      component: <AccountsSummary />
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders responsively at different breakpoints', () => {
    const { rerender } = setupTest({}, {
      component: <AccountsSummary />
    });

    // Test mobile layout
    testUtils.act(() => {
      window.innerWidth = 375;
      window.dispatchEvent(new Event('resize'));
    });
    
    // Test desktop layout
    testUtils.act(() => {
      window.innerWidth = 1024;
      window.dispatchEvent(new Event('resize'));
    });
  });
});

describe('BudgetProgress Component', () => {
  it('renders budget progress bars correctly', () => {
    const { getAllByRole, getByText } = setupTest({}, {
      component: <BudgetProgress />
    });

    const progressBars = getAllByRole('progressbar');
    expect(progressBars).toHaveLength(mockBudgets.length);
    expect(getByText('Groceries')).toBeInTheDocument();
    expect(getByText('75%')).toBeInTheDocument(); // 450/600
  });

  it('triggers threshold alerts correctly', () => {
    const onThresholdExceeded = jest.fn();
    setupTest({}, {
      component: <BudgetProgress onThresholdExceeded={onThresholdExceeded} />
    });

    expect(onThresholdExceeded).toHaveBeenCalledWith(
      expect.objectContaining({ id: '2', category: 'Transport' })
    );
  });

  it('handles empty state gracefully', () => {
    const { getByText } = setupTest({
      budgets: { budgets: [] }
    }, {
      component: <BudgetProgress showEmpty={true} />
    });

    expect(getByText('No budgets configured')).toBeInTheDocument();
  });

  it('meets performance requirements', async () => {
    const startTime = performance.now();
    
    setupTest({}, {
      component: <BudgetProgress />
    });

    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
  });
});

describe('NetWorthCard Component', () => {
  it('calculates and displays net worth correctly', () => {
    const { getByText } = setupTest({}, {
      component: <NetWorthCard accounts={mockAccounts} />
    });

    expect(getByText('Net Worth')).toBeInTheDocument();
    expect(getByText('$15,000.00')).toBeInTheDocument();
    expect(getByText('$15,000.00')).toBeInTheDocument(); // Assets
    expect(getByText('$0.00')).toBeInTheDocument(); // Debts
  });

  it('handles loading state appropriately', () => {
    const { getByTestId } = setupTest({}, {
      component: <NetWorthCard accounts={[]} isLoading={true} />
    });

    expect(getByTestId('net-worth-loading')).toBeInTheDocument();
  });

  it('updates on account changes', async () => {
    const { rerender, getByText } = setupTest({}, {
      component: <NetWorthCard accounts={mockAccounts} />
    });

    const updatedAccounts = [...mockAccounts, {
      id: '3',
      name: 'Credit Card',
      type: 'CREDIT',
      balance: -1000,
      currency: 'USD',
      status: 'ACTIVE'
    }];

    rerender(
      <Provider store={setupTest().store}>
        <NetWorthCard accounts={updatedAccounts} />
      </Provider>
    );

    await waitFor(() => {
      expect(getByText('$14,000.00')).toBeInTheDocument(); // Updated net worth
    });
  });
});

describe('RecentTransactions Component', () => {
  it('renders transaction list correctly', () => {
    const { getAllByRole, getByText } = setupTest({}, {
      component: <RecentTransactions limit={5} onTransactionPress={() => {}} />
    });

    const transactions = getAllByRole('button');
    expect(transactions).toHaveLength(mockTransactions.length);
    expect(getByText('Walmart')).toBeInTheDocument();
    expect(getByText('-$54.23')).toBeInTheDocument();
  });

  it('handles transaction selection', () => {
    const onTransactionPress = jest.fn();
    const { getAllByRole } = setupTest({}, {
      component: <RecentTransactions limit={5} onTransactionPress={onTransactionPress} />
    });

    fireEvent.press(getAllByRole('button')[0]);
    expect(onTransactionPress).toHaveBeenCalledWith(mockTransactions[0]);
  });

  it('implements infinite scroll correctly', async () => {
    const { getByTestId } = setupTest({}, {
      component: <RecentTransactions limit={5} onTransactionPress={() => {}} />
    });

    const list = getByTestId('transaction-list');
    fireEvent.scroll(list, {
      nativeEvent: {
        contentOffset: { y: 500 },
        contentSize: { height: 500, width: 100 },
        layoutMeasurement: { height: 100, width: 100 }
      }
    });

    await waitFor(() => {
      expect(list.props.onEndReached).toHaveBeenCalled();
    });
  });

  it('handles refresh functionality', async () => {
    const { getByTestId } = setupTest({}, {
      component: <RecentTransactions limit={5} onTransactionPress={() => {}} />
    });

    fireEvent.refresh(getByTestId('refresh-control'));
    await waitFor(() => {
      expect(getByTestId('loading-indicator')).not.toBeInTheDocument();
    });
  });
});