import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native'; // ^6.0.0
import analytics from '@segment/analytics-react-native'; // ^2.0.0

import { Transaction } from '../../types/models';
import { useTransactions } from '../../hooks/useTransactions';
import { CategoryPicker } from '../../components/transactions/CategoryPicker';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useTheme } from '../../hooks/useTheme';

interface TransactionDetailScreenProps {
  route: RouteProp<RootStackParamList, 'TransactionDetail'>;
}

interface TransactionDetailRouteParams {
  transactionId: string;
}

const TransactionDetailScreen: React.FC<TransactionDetailScreenProps> = React.memo(() => {
  // Hooks
  const route = useRoute();
  const navigation = useNavigation();
  const { theme, currentBreakpoint } = useTheme();
  const { transactionId } = route.params as TransactionDetailRouteParams;

  // State management
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Custom hooks
  const { updateTransactionCategory, getTransactionById } = useTransactions();

  // Fetch transaction data
  useEffect(() => {
    const loadTransaction = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getTransactionById(transactionId);
        setTransaction(data);
        
        // Track screen view
        analytics.screen('Transaction Detail', {
          transactionId,
          amount: data.amount,
          category: data.category,
        });
      } catch (err) {
        setError('Failed to load transaction details');
        console.error('Error loading transaction:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTransaction();

    return () => {
      // Cleanup analytics
      analytics.reset();
    };
  }, [transactionId, getTransactionById]);

  // Handle category update
  const handleCategoryUpdate = useCallback(async (newCategory: string) => {
    if (!transaction) return;

    try {
      setIsLoading(true);
      await updateTransactionCategory(transaction.id, newCategory);
      
      // Update local state
      setTransaction(prev => prev ? { ...prev, category: newCategory } : null);
      
      // Track category update
      analytics.track('Transaction Category Updated', {
        transactionId: transaction.id,
        oldCategory: transaction.category,
        newCategory,
      });
    } catch (err) {
      setError('Failed to update category');
      console.error('Error updating category:', err);
    } finally {
      setIsLoading(false);
      setShowCategoryPicker(false);
    }
  }, [transaction, updateTransactionCategory]);

  // Memoized styles based on theme and breakpoint
  const styles = useMemo(() => createStyles(theme, currentBreakpoint), [theme, currentBreakpoint]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.brand.primary} />
      </View>
    );
  }

  if (error || !transaction) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Transaction not found'}</Text>
        <TouchableOpacity 
          onPress={navigation.goBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      accessibilityRole="scrollview"
      accessibilityLabel="Transaction details"
    >
      {/* Amount Section */}
      <View style={styles.amountSection}>
        <Text style={styles.amountLabel}>Amount</Text>
        <Text style={styles.amount} accessibilityLabel={`Amount ${formatCurrency(transaction.amount)}`}>
          {formatCurrency(transaction.amount)}
        </Text>
      </View>

      {/* Details Section */}
      <View style={styles.detailsSection}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>
            {formatDate(transaction.date)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Merchant</Text>
          <View style={styles.merchantContainer}>
            {transaction.merchantLogo && (
              <View style={styles.merchantLogo} accessibilityRole="image">
                <Text>{transaction.merchantName[0]}</Text>
              </View>
            )}
            <Text style={styles.detailValue}>{transaction.merchantName}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Category</Text>
          <TouchableOpacity 
            onPress={() => setShowCategoryPicker(true)}
            style={styles.categoryButton}
            accessibilityRole="button"
            accessibilityLabel={`Change category from ${transaction.category}`}
          >
            <Text style={styles.categoryText}>{transaction.category}</Text>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Description</Text>
          <Text style={styles.detailValue}>{transaction.description}</Text>
        </View>
      </View>

      {/* Category Picker Modal */}
      <CategoryPicker
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        initialCategory={transaction.category}
        onCategorySelect={handleCategoryUpdate}
        isLoading={isLoading}
        testID="transaction-category-picker"
      />
    </ScrollView>
  );
});

const createStyles = (theme: Theme, breakpoint: string) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  contentContainer: {
    padding: theme.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background.primary,
  },
  errorText: {
    color: theme.colors.status.error,
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  backButton: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.brand.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.fontSize.md,
  },
  amountSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  amountLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  amount: {
    fontSize: theme.typography.fontSize.display1,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
  },
  detailsSection: {
    backgroundColor: theme.colors.background.card,
    borderRadius: 12,
    padding: theme.spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.shadow.light,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.primary,
  },
  detailLabel: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
    flex: 1,
  },
  detailValue: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.primary,
    flex: 2,
    textAlign: 'right',
  },
  merchantContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
  },
  merchantLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
  },
  categoryText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.primary,
    marginRight: theme.spacing.sm,
  },
  editText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.brand.primary,
  },
});

export default TransactionDetailScreen;