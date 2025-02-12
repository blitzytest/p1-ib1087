import React, { useCallback, useEffect, useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import useAnalytics from '@react-native-firebase/analytics'; // ^18.0.0
import LoadingSpinner from '@react-native-loading-spinner-overlay'; // ^3.0.0

import AllocationChart from '../../components/investments/AllocationChart';
import PerformanceMetrics from '../../components/investments/PerformanceMetrics';
import PortfolioChart from '../../components/investments/PortfolioChart';
import { useInvestments } from '../../hooks/useInvestments';
import { useTheme } from '../../hooks/useTheme';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

const PortfolioScreen: React.FC = React.memo(() => {
  const analytics = useAnalytics();
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = React.useState(false);

  // Get investment data and operations
  const {
    investments,
    performance,
    allocation,
    isLoading,
    error,
    refreshPortfolio,
    loadingStates
  } = useInvestments();

  // Track screen view
  useEffect(() => {
    analytics().logScreenView({
      screen_name: 'Portfolio',
      screen_class: 'PortfolioScreen'
    });
  }, [analytics]);

  // Handle refresh action
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await refreshPortfolio();
      analytics().logEvent('portfolio_refreshed', {
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('Failed to refresh portfolio:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refreshPortfolio, analytics]);

  // Error fallback component
  const ErrorFallback = useCallback(({ error, resetErrorBoundary }) => (
    <View style={styles.errorContainer}>
      <Text style={[styles.errorText, { color: theme.colors.status.error }]}>
        Something went wrong: {error.message}
      </Text>
      <Text 
        style={[styles.errorText, { color: theme.colors.text.link }]}
        onPress={resetErrorBoundary}
      >
        Try again
      </Text>
    </View>
  ), [theme]);

  // Calculate total portfolio value
  const portfolioValue = useMemo(() => 
    investments?.reduce((sum, inv) => sum + inv.value, 0) || 0,
    [investments]
  );

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={refreshPortfolio}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
        <LoadingSpinner
          visible={isLoading && !refreshing}
          textContent="Loading Portfolio..."
          textStyle={{ color: theme.colors.text.primary }}
        />

        <ScrollView
          style={styles.scrollContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.brand.primary}
              progressBackgroundColor={theme.colors.background.secondary}
            />
          }
          accessibilityLabel="Portfolio screen scrollable content"
        >
          {/* Portfolio Summary Section */}
          <View style={styles.summaryContainer}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
              Portfolio Summary
            </Text>
            <Text 
              style={[styles.portfolioValue, { color: theme.colors.text.primary }]}
              accessibilityLabel={`Total portfolio value ${portfolioValue.toLocaleString()} dollars`}
            >
              ${portfolioValue.toLocaleString()}
            </Text>
          </View>

          {/* Performance Metrics Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
              Performance
            </Text>
            <PerformanceMetrics
              investments={investments}
              timeframe="YTD"
              isLoading={loadingStates.performance}
              onError={(error) => {
                console.error('Performance metrics error:', error);
                analytics().logEvent('performance_metrics_error', {
                  error_message: error.message
                });
              }}
            />
          </View>

          {/* Asset Allocation Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
              Asset Allocation
            </Text>
            <View style={styles.chartContainer}>
              <AllocationChart
                width={300}
                height={300}
                theme={{
                  colors: {
                    primary: theme.colors.brand.primary,
                    error: theme.colors.status.error,
                    background: theme.colors.background.card,
                    text: theme.colors.text.primary
                  }
                }}
              />
            </View>
          </View>

          {/* Portfolio Chart Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
              Portfolio Breakdown
            </Text>
            <View style={styles.chartContainer}>
              <PortfolioChart
                width={300}
                height={300}
                showLabels={true}
                animationDuration={PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME}
                accessible={true}
                accessibilityLabel="Interactive portfolio breakdown chart"
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </ErrorBoundary>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  summaryContainer: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  portfolioValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 8,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    accessibilityRole: 'header',
  },
  chartContainer: {
    height: 300,
    marginVertical: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default PortfolioScreen;