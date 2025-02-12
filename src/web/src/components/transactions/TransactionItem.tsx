import React from 'react'; // ^18.0.0
import { StyleSheet, View, Text, Pressable, ViewStyle } from 'react-native'; // 0.71+
import { Transaction } from '../../types/models';
import Card from '../common/Card';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useTheme } from '../../hooks/useTheme';

/**
 * Props interface for the TransactionItem component
 */
interface TransactionItemProps {
  /** Transaction data to display */
  transaction: Transaction;
  /** Optional callback for when the transaction item is pressed */
  onPress?: () => void;
  /** Optional style overrides */
  style?: ViewStyle;
  /** Optional test ID for testing */
  testID?: string;
  /** Optional loading state */
  isLoading?: boolean;
}

/**
 * A reusable component that displays a single transaction item with details
 * including amount, description, category and date.
 */
const TransactionItem: React.FC<TransactionItemProps> = React.memo(({
  transaction,
  onPress,
  style,
  testID = 'transaction-item',
  isLoading = false
}) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Format transaction data
  const formattedAmount = formatCurrency(transaction.amount);
  const formattedDate = formatDate(transaction.date);
  const isNegative = transaction.amount < 0;

  // Determine amount color based on value
  const amountColor = {
    color: isNegative ? theme.colors.status.error : theme.colors.status.success
  };

  const renderContent = () => (
    <View style={styles.container}>
      <View style={styles.mainContent}>
        <View style={styles.descriptionContainer}>
          <Text 
            style={styles.description}
            numberOfLines={1}
            accessibilityLabel={`Transaction: ${transaction.description}`}
          >
            {transaction.description}
          </Text>
          <Text 
            style={[styles.category]}
            accessibilityLabel={`Category: ${transaction.category}`}
          >
            {transaction.category}
          </Text>
        </View>
        <View style={styles.amountContainer}>
          <Text 
            style={[styles.amount, amountColor]}
            accessibilityLabel={`Amount: ${formattedAmount}`}
          >
            {formattedAmount}
          </Text>
          <Text 
            style={styles.date}
            accessibilityLabel={`Date: ${formattedDate}`}
          >
            {formattedDate}
          </Text>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <Card 
        style={[styles.loadingContainer, style]}
        testID={`${testID}-loading`}
      >
        <View style={styles.loadingContent}>
          <View style={styles.loadingDescription} />
          <View style={styles.loadingAmount} />
        </View>
      </Card>
    );
  }

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${transaction.description}`}
        testID={testID}
      >
        <Card style={[styles.card, style]}>
          {renderContent()}
        </Card>
      </Pressable>
    );
  }

  return (
    <Card style={[styles.card, style]} testID={testID}>
      {renderContent()}
    </Card>
  );
});

/**
 * Styles for the TransactionItem component
 */
const createStyles = (theme: Theme) => StyleSheet.create({
  card: {
    marginVertical: theme.spacing.xs,
  },
  container: {
    padding: theme.spacing.sm,
  },
  mainContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  descriptionContainer: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  description: {
    ...theme.typography.fontSize.md,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  category: {
    ...theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    backgroundColor: theme.colors.background.tertiary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    ...theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
    marginBottom: theme.spacing.xs,
  },
  date: {
    ...theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
  },
  loadingContainer: {
    opacity: 0.7,
  },
  loadingContent: {
    padding: theme.spacing.sm,
  },
  loadingDescription: {
    height: 20,
    width: '60%',
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 4,
    marginBottom: theme.spacing.sm,
  },
  loadingAmount: {
    height: 20,
    width: '30%',
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 4,
    alignSelf: 'flex-end',
  },
});

export default TransactionItem;