import React from 'react'; // ^18.0.0
import { StyleSheet, View, Text, useWindowDimensions } from 'react-native'; // 0.71+
import analytics from '@segment/analytics-next'; // ^1.51.0

import Card from '../common/Card';
import { Account } from '../../types/models';
import { formatCurrency } from '../../utils/formatters';
import { useTheme } from '../../hooks/useTheme';

/**
 * Props interface for NetWorthCard component
 */
interface NetWorthCardProps {
  accounts: Account[];
  isLoading?: boolean;
  onError?: (error: Error) => void;
  onRefresh?: () => void;
  testID?: string;
}

/**
 * Interface for net worth calculation results
 */
interface NetWorthCalculation {
  netWorth: number;
  assets: number;
  debts: number;
  hasData: boolean;
}

/**
 * Calculates net worth from account balances
 */
const calculateNetWorth = (accounts: Account[]): NetWorthCalculation => {
  try {
    if (!Array.isArray(accounts)) {
      throw new Error('Invalid accounts data');
    }

    const validAccounts = accounts.filter(acc => 
      acc?.balance !== null && acc?.balance !== undefined
    );

    const assets = validAccounts
      .filter(acc => acc.balance > 0)
      .reduce((sum, acc) => sum + acc.balance, 0);

    const debts = Math.abs(
      validAccounts
        .filter(acc => acc.balance < 0)
        .reduce((sum, acc) => sum + acc.balance, 0)
    );

    return {
      netWorth: assets - debts,
      assets,
      debts,
      hasData: validAccounts.length > 0
    };
  } catch (error) {
    console.error('Net worth calculation error:', error);
    return {
      netWorth: 0,
      assets: 0,
      debts: 0,
      hasData: false
    };
  }
};

/**
 * A responsive card component that displays the user's net worth with assets and debts breakdown
 */
const NetWorthCard: React.FC<NetWorthCardProps> = React.memo(({
  accounts,
  isLoading = false,
  onError,
  onRefresh,
  testID = 'net-worth-card'
}) => {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const styles = React.useMemo(() => createStyles(theme, width), [theme, width]);

  // Track component render
  React.useEffect(() => {
    analytics.track('Net Worth Card Viewed', {
      timestamp: new Date().toISOString(),
      accountCount: accounts.length
    });
  }, []);

  // Calculate net worth with error boundary
  const { netWorth, assets, debts, hasData } = React.useMemo(() => {
    try {
      return calculateNetWorth(accounts);
    } catch (error) {
      onError?.(error as Error);
      return {
        netWorth: 0,
        assets: 0,
        debts: 0,
        hasData: false
      };
    }
  }, [accounts, onError]);

  if (isLoading) {
    return (
      <Card 
        testID={`${testID}-loading`}
        style={styles.container}
        accessible={false}
      >
        <View style={styles.loadingContainer}>
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
        </View>
      </Card>
    );
  }

  return (
    <Card
      testID={testID}
      style={styles.container}
      onPress={onRefresh}
      accessibilityLabel="Net worth summary"
      accessibilityHint="Double tap to refresh"
    >
      <View style={styles.header}>
        <Text 
          style={styles.title}
          accessibilityRole="header"
        >
          Net Worth
        </Text>
        <Text 
          style={styles.netWorth}
          accessibilityLabel={`Net worth ${formatCurrency(netWorth)}`}
        >
          {hasData ? formatCurrency(netWorth) : 'No Data'}
        </Text>
      </View>

      <View 
        style={styles.breakdown}
        accessibilityRole="list"
      >
        <View style={styles.row}>
          <Text style={styles.label}>Assets</Text>
          <Text 
            style={[styles.value, styles.positive]}
            accessibilityLabel={`Assets ${formatCurrency(assets)}`}
          >
            {formatCurrency(assets)}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Debts</Text>
          <Text 
            style={[styles.value, styles.negative]}
            accessibilityLabel={`Debts ${formatCurrency(debts)}`}
          >
            {formatCurrency(debts)}
          </Text>
        </View>
      </View>
    </Card>
  );
});

/**
 * Creates responsive styles for the net worth card
 */
const createStyles = (theme: Theme, screenWidth: number) => StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  header: {
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.fontFamily.medium,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  netWorth: {
    ...theme.typography.fontFamily.bold,
    fontSize: screenWidth < theme.breakpoints.tablet 
      ? theme.typography.fontSize.xl 
      : theme.typography.fontSize.xxl,
    color: theme.colors.text.primary,
  },
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.primary,
    paddingTop: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  label: {
    ...theme.typography.fontFamily.regular,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
  },
  value: {
    ...theme.typography.fontFamily.medium,
    fontSize: theme.typography.fontSize.md,
  },
  positive: {
    color: theme.colors.status.success,
  },
  negative: {
    color: theme.colors.status.error,
  },
  loadingContainer: {
    gap: theme.spacing.md,
  },
  skeleton: {
    height: 24,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 4,
    opacity: 0.3,
  },
});

export default NetWorthCard;