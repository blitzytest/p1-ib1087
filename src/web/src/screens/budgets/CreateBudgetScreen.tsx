import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView, AccessibilityInfo } from 'react-native'; // 0.71+
import { useNavigation, useRoute } from '@react-navigation/native'; // ^6.0.0
import analytics from '@react-native-firebase/analytics'; // ^18.0.0

import { Budget } from '../../types/models';
import { BudgetForm } from '../../components/budgets/BudgetForm';
import { useBudgets } from '../../hooks/useBudgets';
import { useTheme } from '../../hooks/useTheme';

/**
 * Enhanced screen component for budget creation with validation and analytics
 */
const CreateBudgetScreen: React.FC = React.memo(() => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { createBudget } = useBudgets();

  // State for form progress tracking
  const [formProgress, setFormProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Setup accessibility announcements
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility('Create Budget Screen');
  }, []);

  /**
   * Enhanced handler for budget form submission with validation
   */
  const handleSubmit = useCallback(async (budgetData: Budget) => {
    try {
      setIsSubmitting(true);

      // Track form submission attempt
      await analytics().logEvent('budget_creation_started', {
        category: budgetData.category,
        amount: budgetData.amount,
        timestamp: new Date().toISOString(),
      });

      // Create budget with enhanced data
      const success = await createBudget({
        ...budgetData,
        period: budgetData.period || 'monthly',
        alertThreshold: budgetData.alertThreshold || 80,
        notificationPreferences: {
          email: budgetData.notificationPreferences?.email || false,
          push: budgetData.notificationPreferences?.push || false,
        },
      });

      if (success) {
        // Track successful creation
        await analytics().logEvent('budget_created_success', {
          category: budgetData.category,
          amount: budgetData.amount,
        });

        // Navigate back with success message
        navigation.goBack();
        AccessibilityInfo.announceForAccessibility('Budget created successfully');
      }
    } catch (error) {
      console.error('Budget creation failed:', error);
      
      // Track failure
      await analytics().logEvent('budget_creation_failed', {
        category: budgetData.category,
        error: (error as Error).message,
      });

      // Announce error to screen readers
      AccessibilityInfo.announceForAccessibility('Failed to create budget. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [createBudget, navigation]);

  /**
   * Handle form cancellation with cleanup
   */
  const handleCancel = useCallback(() => {
    analytics().logEvent('budget_creation_cancelled');
    navigation.goBack();
  }, [navigation]);

  /**
   * Track form progress for analytics
   */
  const handleProgressUpdate = useCallback((progress: number) => {
    setFormProgress(progress);
    if (progress % 25 === 0) { // Track at 25% intervals
      analytics().logEvent('budget_creation_progress', {
        progress,
        timestamp: new Date().toISOString(),
      });
    }
  }, []);

  /**
   * Handle validation errors with user feedback
   */
  const handleValidationError = useCallback((error: Error) => {
    analytics().logEvent('budget_validation_error', {
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    AccessibilityInfo.announceForAccessibility(`Validation error: ${error.message}`);
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    content: {
      flex: 1,
      padding: theme.spacing.md,
    },
  });

  return (
    <SafeAreaView 
      style={styles.container}
      accessible={true}
      accessibilityLabel="Create Budget Screen"
      accessibilityRole="none"
    >
      <View style={styles.content}>
        <BudgetForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onProgressUpdate={handleProgressUpdate}
          onValidationError={handleValidationError}
          testID="create-budget-form"
        />
      </View>
    </SafeAreaView>
  );
});

CreateBudgetScreen.displayName = 'CreateBudgetScreen';

export default CreateBudgetScreen;