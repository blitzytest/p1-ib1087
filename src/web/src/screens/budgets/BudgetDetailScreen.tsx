import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, Alert, TouchableOpacity, Animated } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import styled from 'styled-components/native';

import BudgetCard from '../../components/budgets/BudgetCard';
import BudgetChart from '../../components/budgets/BudgetChart';
import { useBudgets } from '../../hooks/useBudgets';
import { useTheme } from '../../hooks/useTheme';
import { Budget } from '../../types/models';

// Styled components with accessibility support
const Container = styled.ScrollView`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.background.primary};
  padding: ${({ theme }) => theme.spacing.md}px;
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.lg}px;
`;

const Title = styled.Text`
  font-size: ${({ theme }) => theme.typography.fontSize.xxl}px;
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const Section = styled.View`
  margin-bottom: ${({ theme }) => theme.spacing.xl}px;
`;

const SectionTitle = styled.Text`
  font-size: ${({ theme }) => theme.typography.fontSize.lg}px;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
`;

const ActionButton = styled.TouchableOpacity<{ variant?: 'danger' }>`
  padding: ${({ theme }) => theme.spacing.sm}px ${({ theme }) => theme.spacing.md}px;
  background-color: ${({ theme, variant }) => 
    variant === 'danger' ? theme.colors.status.error : theme.colors.brand.primary};
  border-radius: 8px;
  align-items: center;
  justify-content: center;
  margin-top: ${({ theme }) => theme.spacing.sm}px;
`;

const ButtonText = styled.Text`
  color: ${({ theme }) => theme.colors.text.inverse};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  font-size: ${({ theme }) => theme.typography.fontSize.md}px;
`;

interface BudgetDetailScreenProps {
  route: {
    params: {
      budgetId: string;
    };
  };
}

const BudgetDetailScreen: React.FC<BudgetDetailScreenProps> = () => {
  // Hooks
  const route = useRoute();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { 
    updateBudget, 
    deleteBudget, 
    getBudgetProgress,
    subscribeToUpdates 
  } = useBudgets();

  // State
  const [budget, setBudget] = useState<Budget | null>(null);
  const [progress, setProgress] = useState({ spent: 0, remaining: 0, percentage: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Get budget ID from route params
  const budgetId = (route.params as { budgetId: string }).budgetId;

  // Memoized values
  const isOverBudget = useMemo(() => 
    progress.spent > (budget?.amount || 0), 
    [progress.spent, budget]
  );

  // Load budget data and set up real-time updates
  useFocusEffect(
    useCallback(() => {
      let unsubscribe: (() => void) | undefined;

      const loadBudget = async () => {
        try {
          setIsLoading(true);
          const budgetProgress = await getBudgetProgress(budgetId);
          setProgress(budgetProgress);
          
          // Set up real-time updates
          unsubscribe = subscribeToUpdates(budgetId, (updatedProgress) => {
            setProgress(updatedProgress);
          });

          // Animate in the content
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        } catch (error) {
          Alert.alert('Error', 'Failed to load budget details');
          console.error('Budget load error:', error);
        } finally {
          setIsLoading(false);
        }
      };

      loadBudget();

      // Cleanup subscription on unmount
      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }, [budgetId, getBudgetProgress, subscribeToUpdates, fadeAnim])
  );

  // Handle budget edit
  const handleEdit = useCallback(async (updates: Partial<Budget>) => {
    try {
      setIsLoading(true);
      const success = await updateBudget(budgetId, updates);
      
      if (!success) {
        throw new Error('Failed to update budget');
      }

      Alert.alert('Success', 'Budget updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update budget');
      console.error('Budget update error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [budgetId, updateBudget]);

  // Handle budget deletion
  const handleDelete = useCallback(async () => {
    Alert.alert(
      'Delete Budget',
      'Are you sure you want to delete this budget? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const success = await deleteBudget(budgetId);
              
              if (!success) {
                throw new Error('Failed to delete budget');
              }

              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete budget');
              console.error('Budget deletion error:', error);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  }, [budgetId, deleteBudget, navigation]);

  if (!budget) {
    return null;
  }

  return (
    <Container
      accessible={true}
      accessibilityRole="main"
      accessibilityLabel="Budget Details Screen"
    >
      <Animated.View style={{ opacity: fadeAnim }}>
        <Header>
          <Title accessibilityRole="header">
            {budget.category} Budget
          </Title>
        </Header>

        <Section>
          <BudgetCard
            budget={budget}
            style={{ marginBottom: theme.spacing.md }}
            isAccessible={true}
          />
        </Section>

        <Section>
          <SectionTitle accessibilityRole="header">
            Spending Progress
          </SectionTitle>
          <BudgetChart
            spent={progress.spent}
            total={budget.amount}
            alertThreshold={budget.alertThreshold}
            accessibilityLabel={`Budget progress: ${progress.percentage}% spent`}
          />
        </Section>

        <Section>
          <ActionButton
            onPress={() => handleEdit(budget)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Edit budget"
            accessibilityHint="Double tap to edit budget details"
          >
            <ButtonText>Edit Budget</ButtonText>
          </ActionButton>

          <ActionButton
            variant="danger"
            onPress={handleDelete}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Delete budget"
            accessibilityHint="Double tap to delete this budget"
          >
            <ButtonText>Delete Budget</ButtonText>
          </ActionButton>
        </Section>
      </Animated.View>
    </Container>
  );
};

export default BudgetDetailScreen;