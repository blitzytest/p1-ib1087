import React, { useCallback, useEffect, useMemo } from 'react';
import { View, FlatList, Text, TouchableOpacity, RefreshControl } from 'react-native'; // 0.71+
import { useNavigation } from '@react-navigation/native'; // ^6.0.0
import styled from 'styled-components'; // ^5.3.0
import { useWindowVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import BudgetCard from '../../components/budgets/BudgetCard';
import { useBudgets } from '../../hooks/useBudgets';
import Loading from '../../components/common/Loading';

// Styled components with accessibility and theme support
const Container = styled(View)`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.background.primary};
  padding-horizontal: ${({ theme }) => theme.spacing.md}px;
`;

const Header = styled(View)`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding-vertical: ${({ theme }) => theme.spacing.md}px;
  border-bottom-width: 1px;
  border-bottom-color: ${({ theme }) => theme.colors.border.primary};
`;

const Title = styled(Text)`
  font-size: ${({ theme }) => theme.typography.fontSize.xl}px;
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const AddButton = styled(TouchableOpacity)`
  background-color: ${({ theme }) => theme.colors.brand.primary};
  padding: ${({ theme }) => theme.spacing.sm}px ${({ theme }) => theme.spacing.md}px;
  border-radius: 8px;
`;

const AddButtonText = styled(Text)`
  color: ${({ theme }) => theme.colors.text.inverse};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

const ErrorContainer = styled(View)`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.xl}px;
`;

const ErrorText = styled(Text)`
  color: ${({ theme }) => theme.colors.status.error};
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.md}px;
`;

const RetryButton = styled(TouchableOpacity)`
  background-color: ${({ theme }) => theme.colors.brand.primary};
  padding: ${({ theme }) => theme.spacing.sm}px ${({ theme }) => theme.spacing.lg}px;
  border-radius: 8px;
  margin-top: ${({ theme }) => theme.spacing.md}px;
`;

interface BudgetsListScreenProps {
  refreshInterval?: number;
  enableOffline?: boolean;
}

const BudgetsListScreen: React.FC<BudgetsListScreenProps> = ({
  refreshInterval = 30000, // 30 seconds default refresh
  enableOffline = true
}) => {
  const navigation = useNavigation();
  const {
    budgets,
    loading,
    error,
    fetchBudgets,
    refreshBudgets,
    cacheBudgets
  } = useBudgets();

  // Setup virtual list for performance
  const virtualizer = useWindowVirtualizer({
    count: budgets.length,
    estimateSize: () => 100, // Estimated height of each budget card
    overscan: 5
  });

  // Initial data fetch
  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  // Setup automatic refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const intervalId = setInterval(() => {
        refreshBudgets();
      }, refreshInterval);

      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, refreshBudgets]);

  // Enable offline support
  useEffect(() => {
    if (enableOffline && budgets.length > 0) {
      cacheBudgets(budgets);
    }
  }, [enableOffline, budgets, cacheBudgets]);

  // Navigation handlers
  const handleBudgetPress = useCallback((budgetId: string) => {
    navigation.navigate('BudgetDetail', { budgetId });
  }, [navigation]);

  const handleAddPress = useCallback(() => {
    navigation.navigate('CreateBudget');
  }, [navigation]);

  // Error fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <ErrorContainer>
      <ErrorText>Something went wrong: {error.message}</ErrorText>
      <RetryButton 
        onPress={resetErrorBoundary}
        accessibilityLabel="Retry loading budgets"
      >
        <Text>Retry</Text>
      </RetryButton>
    </ErrorContainer>
  );

  // Render budget item
  const renderBudgetItem = useCallback(({ item: budget }) => (
    <BudgetCard
      budget={budget}
      onPress={() => handleBudgetPress(budget.id)}
      style={{ marginVertical: 8 }}
      isAccessible={true}
    />
  ), [handleBudgetPress]);

  // Memoized key extractor
  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={fetchBudgets}>
      <Container accessibilityRole="main">
        <Header>
          <Title accessibilityRole="header">Budgets</Title>
          <AddButton
            onPress={handleAddPress}
            accessibilityLabel="Create new budget"
            accessibilityRole="button"
          >
            <AddButtonText>Add Budget</AddButtonText>
          </AddButton>
        </Header>

        {loading && !budgets.length ? (
          <Loading size="large" accessibilityLabel="Loading budgets" />
        ) : (
          <FlatList
            data={budgets}
            renderItem={renderBudgetItem}
            keyExtractor={keyExtractor}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={fetchBudgets}
                accessibilityLabel="Pull to refresh budgets"
              />
            }
            getItemLayout={(data, index) => ({
              length: 100,
              offset: 100 * index,
              index,
            })}
            windowSize={5}
            maxToRenderPerBatch={10}
            initialNumToRender={5}
            onEndReachedThreshold={0.5}
            accessibilityRole="list"
            accessibilityLabel="Budgets list"
          />
        )}
      </Container>
    </ErrorBoundary>
  );
};

export default React.memo(BudgetsListScreen);