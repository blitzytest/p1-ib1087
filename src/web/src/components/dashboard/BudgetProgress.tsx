import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, AccessibilityInfo } from 'react-native';
import { useSelector } from 'react-redux'; // ^8.0.0
import styled from 'styled-components'; // ^5.3.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { Budget } from '../../types/models';
import { selectBudgets } from '../../store/slices/budgetsSlice';

// Styled components with theme support and accessibility
const Container = styled(View)`
  padding: 16px;
  background-color: ${({ theme }) => theme.colors.surface};
  border-radius: 8px;
  margin-bottom: 16px;
  elevation: 2;
  shadow-color: rgba(0, 0, 0, 0.1);
  shadow-offset: 0px 2px;
  shadow-radius: 4px;
`;

const ProgressBarContainer = styled(View)`
  height: 8px;
  background-color: ${({ theme }) => theme.colors.background};
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0;
`;

const ProgressBar = styled(View)<{ progress: number; isOverBudget: boolean }>`
  width: ${({ progress }) => `${progress}%`};
  height: 100%;
  background-color: ${({ theme, isOverBudget }) => 
    isOverBudget ? theme.colors.error : theme.colors.primary};
  border-radius: 4px;
  transition: width 0.3s ease-in-out;
`;

const CategoryText = styled(Text)`
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 4px;
`;

const AmountText = styled(Text)`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const ErrorContainer = styled(View)`
  padding: 16px;
  background-color: ${({ theme }) => theme.colors.errorLight};
  border-radius: 8px;
  margin-bottom: 16px;
`;

const ErrorText = styled(Text)`
  color: ${({ theme }) => theme.colors.error};
  font-size: 14px;
  text-align: center;
`;

const LoadingContainer = styled(View)`
  padding: 16px;
`;

const SkeletonBar = styled(View)`
  height: 8px;
  background-color: ${({ theme }) => theme.colors.skeleton};
  border-radius: 4px;
  margin: 8px 0;
  animation: pulse 1.5s infinite;
`;

// Props interface
interface BudgetProgressProps {
  style?: ViewStyle;
  maxItems?: number;
  showEmpty?: boolean;
  onThresholdExceeded?: (budget: Budget) => void;
}

// Helper function to calculate progress percentage
const calculateProgress = (spent: number, total: number): number => {
  if (!total || total <= 0) return 0;
  const progress = (spent / total) * 100;
  return Math.min(Math.max(Math.round(progress * 10) / 10, 0), 100);
};

// Error Fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <ErrorContainer>
    <ErrorText>Unable to display budget progress: {error.message}</ErrorText>
  </ErrorContainer>
);

// Main component
const BudgetProgress: React.FC<BudgetProgressProps> = ({
  style,
  maxItems = 5,
  showEmpty = false,
  onThresholdExceeded
}) => {
  const budgets = useSelector(selectBudgets);

  // Sort budgets by percentage spent and limit to maxItems
  const sortedBudgets = useMemo(() => {
    return [...budgets]
      .sort((a, b) => (b.spent / b.amount) - (a.spent / a.amount))
      .slice(0, maxItems);
  }, [budgets, maxItems]);

  // Handle threshold exceeded notifications
  useEffect(() => {
    sortedBudgets.forEach(budget => {
      const progress = calculateProgress(budget.spent, budget.amount);
      if (progress >= (budget.alertThreshold || 90) && onThresholdExceeded) {
        onThresholdExceeded(budget);
      }
    });
  }, [sortedBudgets, onThresholdExceeded]);

  // Accessibility announcement for budget progress
  const announceProgress = useCallback((budget: Budget) => {
    const progress = calculateProgress(budget.spent, budget.amount);
    const message = `${budget.category} budget: ${progress}% used. ${
      budget.spent
    } spent out of ${budget.amount}`;
    AccessibilityInfo.announce(message);
  }, []);

  if (!budgets.length && !showEmpty) {
    return null;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Container style={style}>
        {sortedBudgets.map((budget) => {
          const progress = calculateProgress(budget.spent, budget.amount);
          const isOverBudget = progress >= (budget.alertThreshold || 90);

          return (
            <View
              key={budget.id}
              accessible={true}
              accessibilityRole="progressbar"
              accessibilityLabel={`${budget.category} budget progress`}
              accessibilityValue={{
                min: 0,
                max: 100,
                now: progress,
              }}
              onAccessibilityTap={() => announceProgress(budget)}
            >
              <CategoryText>{budget.category}</CategoryText>
              <ProgressBarContainer>
                <ProgressBar
                  progress={progress}
                  isOverBudget={isOverBudget}
                />
              </ProgressBarContainer>
              <AmountText>
                ${budget.spent.toLocaleString()} of ${budget.amount.toLocaleString()}
                {isOverBudget && ' ⚠️'}
              </AmountText>
            </View>
          );
        })}
      </Container>
    </ErrorBoundary>
  );
};

// Loading state component
export const BudgetProgressSkeleton: React.FC = () => (
  <LoadingContainer>
    {[1, 2, 3].map((key) => (
      <View key={key}>
        <SkeletonBar />
      </View>
    ))}
  </LoadingContainer>
);

export default BudgetProgress;