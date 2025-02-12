import React from 'react'; // ^18.0.0
import { StyleSheet, View, Text, Platform } from 'react-native'; // 0.71+
import { formatRelative } from 'date-fns'; // ^2.30.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { useAnalytics } from '@analytics/react'; // ^0.1.0
import Card from '../common/Card';
import { useTheme } from '../../hooks/useTheme';

/**
 * Props interface for the AccountCard component
 */
interface AccountCardProps {
  account: {
    id: string;
    name: string;
    type: string;
    balance: number;
    lastSynced: Date;
    institution: string;
  };
  onPress?: () => void;
  disabled?: boolean;
  isRTL?: boolean;
  isDarkMode?: boolean;
  testID?: string;
}

/**
 * A reusable card component for displaying financial account information
 * Supports RTL layouts, dark mode, and accessibility features
 */
const AccountCard: React.FC<AccountCardProps> = React.memo(({
  account,
  onPress,
  disabled = false,
  isRTL = false,
  isDarkMode = false,
  testID
}) => {
  // Theme and analytics hooks
  const { theme } = useTheme();
  const analytics = useAnalytics();

  // Memoized styles
  const styles = React.useMemo(() => 
    createStyles(theme, isDarkMode, isRTL), 
    [theme, isDarkMode, isRTL]
  );

  // Format currency with proper localization
  const formattedBalance = React.useMemo(() => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(account.balance);
  }, [account.balance]);

  // Format relative time for last sync
  const lastSyncedText = React.useMemo(() => {
    return formatRelative(new Date(account.lastSynced), new Date());
  }, [account.lastSynced]);

  // Handle press with analytics tracking
  const handlePress = React.useCallback(() => {
    analytics.track('account_card_pressed', {
      accountId: account.id,
      accountType: account.type,
      institution: account.institution
    });
    onPress?.();
  }, [account.id, account.type, account.institution, onPress, analytics]);

  // Error fallback component
  const ErrorFallback = React.useCallback(({ error }: { error: Error }) => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>
        Error displaying account: {error.message}
      </Text>
    </View>
  ), [styles]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Card
        onPress={handlePress}
        disabled={disabled}
        accessibilityLabel={`${account.name} account with balance ${formattedBalance}`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        testID={testID}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.institutionName} numberOfLines={1}>
            {account.institution}
          </Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{account.type}</Text>
          </View>
        </View>

        <Text style={styles.accountName} numberOfLines={1}>
          {account.name}
        </Text>

        <Text style={styles.balance}>
          {formattedBalance}
        </Text>

        <Text style={styles.lastSynced}>
          Last updated {lastSyncedText}
        </Text>
      </Card>
    </ErrorBoundary>
  );
});

/**
 * Creates stylesheet for account card with theme and mode support
 */
const createStyles = (theme: Theme, isDarkMode: boolean, isRTL: boolean) => 
  StyleSheet.create({
    container: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      padding: theme.spacing.md,
      backgroundColor: isDarkMode ? theme.colors.background.card : theme.colors.background.primary,
    },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.xs,
    },
    institutionName: {
      ...theme.typography.fontFamily.medium,
      fontSize: theme.typography.fontSize.sm,
      color: isDarkMode ? theme.colors.text.inverse : theme.colors.text.primary,
      textAlign: isRTL ? 'right' : 'left',
    },
    typeBadge: {
      backgroundColor: theme.colors.background.tertiary,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: 4,
    },
    typeText: {
      ...theme.typography.fontFamily.medium,
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.text.secondary,
      textTransform: 'uppercase',
    },
    accountName: {
      ...theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.md,
      color: isDarkMode ? theme.colors.text.inverse : theme.colors.text.primary,
      marginBottom: theme.spacing.xs,
      textAlign: isRTL ? 'right' : 'left',
    },
    balance: {
      ...theme.typography.fontFamily.bold,
      fontSize: theme.typography.fontSize.xl,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
      textAlign: isRTL ? 'right' : 'left',
    },
    lastSynced: {
      ...theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.text.tertiary,
      textAlign: isRTL ? 'right' : 'left',
    },
    errorContainer: {
      padding: theme.spacing.md,
      backgroundColor: theme.colors.status.errorLight,
      borderRadius: 8,
    },
    errorText: {
      ...theme.typography.fontFamily.medium,
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.status.error,
      textAlign: 'center',
    },
  });

// Export memoized component
export default AccountCard;