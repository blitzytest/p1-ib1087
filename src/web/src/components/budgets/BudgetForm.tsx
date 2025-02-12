import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Animated, Text, Switch, Platform } from 'react-native'; // 0.71+
import Input from '../common/Input';
import { Budget } from '../../types/models';
import { useBudgets } from '../../hooks/useBudgets';
import { useTheme } from '../../hooks/useTheme';
import { BudgetPeriod } from '../../types/api';

interface BudgetFormProps {
  budget?: Budget;
  onSubmit: (budget: Budget) => Promise<void>;
  onCancel: () => void;
  onProgressUpdate: (progress: number) => void;
}

interface FormState {
  category: string;
  amount: number;
  period: BudgetPeriod;
  alertThreshold: number;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

interface ValidationErrors {
  category?: string;
  amount?: string;
  alertThreshold?: string;
}

const BudgetForm: React.FC<BudgetFormProps> = React.memo(({ 
  budget, 
  onSubmit, 
  onCancel, 
  onProgressUpdate 
}) => {
  const { theme } = useTheme();
  const { createBudget, updateBudget } = useBudgets();
  const progressAnimation = useRef(new Animated.Value(0)).current;

  // Form state initialization
  const [formState, setFormState] = useState<FormState>({
    category: budget?.category || '',
    amount: budget?.amount || 0,
    period: budget?.period as BudgetPeriod || BudgetPeriod.MONTHLY,
    alertThreshold: budget?.alertThreshold || 80,
    emailNotifications: budget?.notificationPreferences?.email || false,
    pushNotifications: budget?.notificationPreferences?.push || false,
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation function
  const validateForm = useCallback((data: FormState): ValidationErrors => {
    const newErrors: ValidationErrors = {};

    if (!data.category.trim()) {
      newErrors.category = 'Category is required';
    }

    if (!data.amount || data.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (data.alertThreshold < 0 || data.alertThreshold > 100) {
      newErrors.alertThreshold = 'Alert threshold must be between 0 and 100';
    }

    return newErrors;
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    try {
      setIsSubmitting(true);
      const validationErrors = validateForm(formState);

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      const budgetData: Omit<Budget, 'id'> = {
        category: formState.category,
        amount: formState.amount,
        period: formState.period,
        alertThreshold: formState.alertThreshold,
        notificationPreferences: {
          email: formState.emailNotifications,
          push: formState.pushNotifications,
        },
      };

      if (budget?.id) {
        await updateBudget(budget.id, budgetData);
      } else {
        await createBudget(budgetData);
      }

      await onSubmit(budgetData as Budget);
    } catch (error) {
      console.error('Failed to submit budget:', error);
      setErrors({ 
        category: 'Failed to save budget. Please try again.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [formState, budget, createBudget, updateBudget, onSubmit, validateForm]);

  // Handle progress animation
  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: formState.alertThreshold / 100,
      duration: 300,
      useNativeDriver: false,
    }).start();

    onProgressUpdate(formState.alertThreshold);
  }, [formState.alertThreshold, progressAnimation, onProgressUpdate]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.background.primary,
    },
    inputContainer: {
      marginBottom: theme.spacing.md,
      width: '100%',
    },
    slider: {
      width: '100%',
      height: 40,
      marginVertical: theme.spacing.sm,
    },
    progressBar: {
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.brand.primary,
      marginVertical: theme.spacing.sm,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
    },
    notificationContainer: {
      marginVertical: theme.spacing.md,
      padding: theme.spacing.sm,
      borderRadius: theme.spacing.sm,
      backgroundColor: theme.colors.background.secondary,
    },
    label: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginVertical: theme.spacing.xs,
    },
  });

  return (
    <ScrollView 
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      accessible={true}
      accessibilityLabel="Budget form"
    >
      <View style={styles.inputContainer}>
        <Input
          value={formState.category}
          onChangeText={(text) => setFormState(prev => ({ ...prev, category: text }))}
          label="Category"
          error={errors.category}
          placeholder="Enter budget category"
          testID="budget-category-input"
          accessibilityLabel="Budget category input"
          autoFocus
        />
      </View>

      <View style={styles.inputContainer}>
        <Input
          value={formState.amount.toString()}
          onChangeText={(text) => {
            const amount = parseFloat(text) || 0;
            setFormState(prev => ({ ...prev, amount }));
          }}
          label="Amount"
          error={errors.amount}
          placeholder="Enter budget amount"
          keyboardType="numeric"
          testID="budget-amount-input"
          accessibilityLabel="Budget amount input"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Alert Threshold ({formState.alertThreshold}%)</Text>
        <Animated.View 
          style={[
            styles.progressBar,
            {
              width: progressAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
        <Input
          value={formState.alertThreshold.toString()}
          onChangeText={(text) => {
            const threshold = Math.min(100, Math.max(0, parseInt(text) || 0));
            setFormState(prev => ({ ...prev, alertThreshold: threshold }));
          }}
          error={errors.alertThreshold}
          keyboardType="numeric"
          testID="budget-threshold-input"
          accessibilityLabel="Alert threshold input"
        />
      </View>

      <View style={styles.notificationContainer}>
        <Text style={styles.label}>Notification Preferences</Text>
        
        <View style={styles.switchRow}>
          <Text>Email Notifications</Text>
          <Switch
            value={formState.emailNotifications}
            onValueChange={(value) => 
              setFormState(prev => ({ ...prev, emailNotifications: value }))
            }
            testID="email-notifications-switch"
            accessibilityLabel="Toggle email notifications"
          />
        </View>

        <View style={styles.switchRow}>
          <Text>Push Notifications</Text>
          <Switch
            value={formState.pushNotifications}
            onValueChange={(value) => 
              setFormState(prev => ({ ...prev, pushNotifications: value }))
            }
            testID="push-notifications-switch"
            accessibilityLabel="Toggle push notifications"
          />
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Animated.Button
          onPress={onCancel}
          title="Cancel"
          testID="cancel-button"
          accessibilityLabel="Cancel budget form"
        />
        <Animated.Button
          onPress={handleSubmit}
          title={isSubmitting ? 'Saving...' : 'Save Budget'}
          disabled={isSubmitting}
          testID="submit-button"
          accessibilityLabel="Save budget"
        />
      </View>
    </ScrollView>
  );
});

BudgetForm.displayName = 'BudgetForm';

export default BudgetForm;