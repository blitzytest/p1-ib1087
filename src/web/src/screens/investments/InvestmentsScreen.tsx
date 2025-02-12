import React, { useCallback, useState, useMemo } from 'react';
import { ScrollView, View, Text, RefreshControl, useWindowDimensions, StyleSheet } from 'react-native'; // 0.71+
import { useFocusEffect } from '@react-navigation/native'; // ^6.0.0
import { debounce } from 'lodash'; // ^4.17.21
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { SkeletonLoader } from '@shopify/restyle'; // ^2.4.0

import AllocationChart from '../../components/investments/AllocationChart';
import PerformanceMetrics from '../../components/investments/PerformanceMetrics';
import PortfolioChart from '../../components/investments/PortfolioChart';
import { useInvestments } from '../../hooks/useInvestments';
import { useTheme } from '../../hooks/useTheme';

const InvestmentsScreen: React.FC = React.memo(() => {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  // Get investment data and states
  const {
    investments: holdings,
    performance,
    allocation,
    isLoading,
    error,
    refreshPortfolio,
    loadingStates
  } = useInvestments();

  // Create debounced refresh function
  const debouncedRefresh = useMemo(
    () => debounce(refreshPortfolio, 300),
    [refreshPortfolio]
  );

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await debouncedRefresh();
    } catch (error) {
      console.error('Failed to refresh portfolio:', error);
    } finally {
      setRefreshing(false);
    }
  }, [debouncedRefresh]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshPortfolio();
      return () => {
        debouncedRefresh.cancel();
      };
    }, [refreshPortfolio, debouncedRefresh])
  );

  // Error fallback component
  const ErrorFallback = useCallback(({ error, resetErrorBoundary }) => (
    <View style={styles.errorContainer}>
      <Text style={[styles.errorText, { color: theme.colors.status.error }]}>
        {error.message || 'An error occurred loading investment data'}
      </Text>
      <Text
        style={[styles.retryText, { color: theme.colors.text.link }]}
        onPress={resetErrorBoundary}
      >
        Tap to retry
      </Text>
    </View>
  ), [theme]);

  // Loading skeleton
  if (isLoading && !refreshing) {
    return (
      <View style={styles.container}>
        <SkeletonLoader
          loading={true}
          containerStyle={styles.skeletonContainer}
        >
          <View style={styles.skeletonChart} />
          <View style={styles.skeletonMetrics} />
          <View style={styles.skeletonAllocation} />
        </SkeletonLoader>
      </View>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={refreshPortfolio}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.brand.primary}
          />
        }
        accessible={true}
        accessibilityLabel="Investment Portfolio Screen"
      >
        {/* Portfolio Value Section */}
        <View style={styles.section}>
          <Text 
            style={[styles.sectionTitle, { color: theme.colors.text.primary }]}
            accessibilityRole="header"
          >
            Portfolio Overview
          </Text>
          <PortfolioChart
            width={width * 0.9}
            height={300}
            showLabels={true}
            accessible={true}
          />
        </View>

        {/* Performance Metrics Section */}
        <View style={styles.section}>
          <Text 
            style={[styles.sectionTitle, { color: theme.colors.text.primary }]}
            accessibilityRole="header"
          >
            Performance
          </Text>
          <PerformanceMetrics
            investments={holdings}
            timeframe="YTD"
            isLoading={loadingStates.performance}
          />
        </View>

        {/* Asset Allocation Section */}
        <View style={styles.section}>
          <Text 
            style={[styles.sectionTitle, { color: theme.colors.text.primary }]}
            accessibilityRole="header"
          >
            Asset Allocation
          </Text>
          <AllocationChart
            width={width * 0.9}
            height={300}
            theme={theme}
          />
        </View>
      </ScrollView>
    </ErrorBoundary>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  contentContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryText: {
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  skeletonContainer: {
    padding: 16,
  },
  skeletonChart: {
    height: 300,
    borderRadius: 8,
    marginBottom: 24,
  },
  skeletonMetrics: {
    height: 120,
    borderRadius: 8,
    marginBottom: 24,
  },
  skeletonAllocation: {
    height: 300,
    borderRadius: 8,
  },
});

export default InvestmentsScreen;