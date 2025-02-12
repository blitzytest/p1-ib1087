import React, { useCallback, useEffect, useRef, memo } from 'react';
import { View, Text, TouchableOpacity, Animated, ViewStyle } from 'react-native';
import styled from 'styled-components';
import Card from '../common/Card';
import { Budget } from '../../types/models';
import { BudgetChart } from './BudgetChart';
import { useTheme } from '../../hooks/useTheme';

/**
 * Props interface for the BudgetCard component
 */
interface BudgetCardProps {
  /** Budget data to display */
  budget: Budget;
  /** Handler for card press action */
  onPress?: () => void;
  /** Optional custom styles */
  style?: ViewStyle;
  /** Flag for enhanced accessibility features */
  isAccessible?: boolean;
}

/**
 * Styled components for the BudgetCard
 */
const Container = styled(Card)`
  padding: ${({ theme }) => theme.spacing.md}px;
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
  elevation: 2;
  shadow-color: ${({ theme }) => theme.colors.shadow.medium};
  shadow-offset: 0px 2px;
  shadow-opacity: 0.25;
  shadow-radius: 3.84px;
  transition: all 0.2s ease-in-out;
`;

const Header = styled(View)`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
  flex-wrap: wrap;
`;

const CategoryText = styled(Text)`
  font-size: ${({ theme }) => theme.typography.fontSize.lg}px;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const AmountText = styled(Text)`
  font-size: ${({ theme }) => theme.typography.fontSize.md}px;
  color: ${({ theme }) => theme.colors.text.secondary};
`;

const ProgressContainer = styled(Animated.View)`
  margin-top: ${({ theme }) => theme.spacing.sm}px;
`;

const AlertIndicator = styled(View)<{ isOverBudget: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background-color: ${({ theme, isOverBudget }) => 
    isOverBudget ? theme.colors.status.error : theme.colors.status.warning};
  margin-left: ${({ theme }) => theme.spacing.xs}px;
`;

/**
 * Formats currency amount with localization support
 */
const formatAmount = (amount: number, locale = 'en-US'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Calculates spending progress percentage
 */
const calculateProgress = (spent: number, total: number): number => {
  if (!total || total <= 0) return 0;
  return Math.min((spent / total) * 100, 100);
};

/**
 * BudgetCard component displays budget information with animations and accessibility
 */
const BudgetCard: React.FC<BudgetCardProps> = memo(({
  budget,
  onPress,
  style,
  isAccessible = true,
}) => {
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Calculate budget metrics
  const progress = calculateProgress(budget.spent, budget.amount);
  const isOverBudget = budget.spent > budget.amount;
  const isNearLimit = progress >= budget.alertThreshold;

  // Fade in animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    return () => {
      fadeAnim.setValue(0);
    };
  }, [fadeAnim]);

  // Memoized press handler
  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    }
  }, [onPress]);

  // Generate accessibility label
  const accessibilityLabel = `${budget.category} budget. ${formatAmount(budget.spent)} spent of ${
    formatAmount(budget.amount)
  }. ${isOverBudget ? 'Over budget!' : isNearLimit ? 'Approaching budget limit.' : ''}`;

  return (
    <Container
      onPress={handlePress}
      style={style}
      accessible={isAccessible}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      testID={`budget-card-${budget.id}`}
    >
      <Header>
        <CategoryText>
          {budget.category}
          {(isOverBudget || isNearLimit) && (
            <AlertIndicator isOverBudget={isOverBudget} />
          )}
        </CategoryText>
        <AmountText>
          {formatAmount(budget.spent)}/{formatAmount(budget.amount)}
        </AmountText>
      </Header>

      <ProgressContainer style={{ opacity: fadeAnim }}>
        <BudgetChart
          spent={budget.spent}
          total={budget.amount}
          alertThreshold={budget.alertThreshold}
          accessibilityLabel={`${progress.toFixed(1)}% of budget used`}
        />
      </ProgressContainer>
    </Container>
  );
});

// Display name for debugging
BudgetCard.displayName = 'BudgetCard';

export default BudgetCard;