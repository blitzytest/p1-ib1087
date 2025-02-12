import React, { useEffect, useCallback, useState } from 'react';
import { 
  ScrollView, 
  RefreshControl, 
  StyleSheet, 
  View, 
  Text 
} from 'react-native'; // 0.71+
import { useRoute } from '@react-navigation/native'; // ^6.0.0
import PerformanceMetrics from '../../components/investments/PerformanceMetrics';
import PortfolioChart from '../../components/investments/PortfolioChart';
import { useInvestments } from '../../hooks/useInvestments';
import { useTheme } from '../../hooks/useTheme';
import Card from '../../components/common/Card';
import { TimeRange } from '../../types/api';

/**
 * Props interface for the InvestmentDetailScreen component
 */
interface InvestmentDetailScreenProps {
  route: RouteProp<RootStackParamList, 'InvestmentDetail'>;
  navigation: NavigationProp<RootStackParamList>;
}

/**
 * Route parameters interface for investment detail screen
 */
interface InvestmentDetailRouteParams {
  investmentId: string;
  accountId: string;
}

/**
 * A comprehensive investment detail screen component that displays portfolio metrics,
 * performance data, and allocation charts with real-time updates and accessibility support.
 */
const InvestmentDetailScreen: React.FC<InvestmentDetailScreenProps> = () => {
  // Theme and navigation hooks
  const { theme } = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'InvestmentDetail'>>();

  // Local state management
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeRange>(TimeRange.YTD);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Extract route params
  const { investmentId, accountId } = route.params as InvestmentDetailRouteParams;

  // Initialize investment data hook with auto-refresh
  const {
    investments,
    performance,
    allocation,
    loadingStates,
    errors,
    refreshPortfolio,
    fetchPerformance
  } = useInvestments(investmentId, {
    refreshInterval: 300000, // 5 minutes
    autoRefresh: true,
    includeHistory: true
  });

  /**
   * Handle pull-to-refresh functionality
   */
  const handleRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await refreshPortfolio();
      await fetchPerformance(selectedTimeframe);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshPortfolio, fetchPerformance, selectedTimeframe]);

  /**
   * Handle timeframe selection
   */
  const handleTimeframeChange = useCallback(async (timeframe: TimeRange) => {
    setSelectedTimeframe(timeframe);
    await fetchPerformance(timeframe);
  }, [fetchPerformance]);

  // Initial data fetch
  useEffect(() => {
    refreshPortfolio();
  }, [refreshPortfolio]);

  // Create memoized styles
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={[theme.colors.brand.primary]}
          tintColor={theme.colors.brand.primary}
        />
      }
      accessible={true}
      accessibilityLabel="Investment portfolio details"
    >
      {/* Portfolio Value Summary */}
      <Card style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>Portfolio Value</Text>
        <Text style={styles.portfolioValue}>
          ${investments.reduce((sum, inv) => sum + inv.value, 0).toLocaleString()}
        </Text>
      </Card>

      {/* Performance Metrics */}
      <PerformanceMetrics
        investments={investments}
        timeframe={selectedTimeframe}
        isLoading={loadingStates.performance}
        onError={(error) => console.error('Performance metrics error:', error)}
      />

      {/* Portfolio Allocation Chart */}
      <Card style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Asset Allocation</Text>
        <PortfolioChart
          width={350}
          height={350}
          showLabels={true}
          animationDuration={1000}
          accessible={true}
        />
      </Card>

      {/* Error States */}
      {Object.entries(errors).map(([key, error]) => 
        error && (
          <Card key={key} style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        )
      )}

      {/* Timeframe Selection */}
      <View style={styles.timeframeContainer}>
        {Object.values(TimeRange).map((timeframe) => (
          <Card
            key={timeframe}
            style={[
              styles.timeframeButton,
              selectedTimeframe === timeframe && styles.selectedTimeframe
            ]}
            onPress={() => handleTimeframeChange(timeframe)}
          >
            <Text
              style={[
                styles.timeframeText,
                selectedTimeframe === timeframe && styles.selectedTimeframeText
              ]}
            >
              {timeframe}
            </Text>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
};

/**
 * Styles creator function using theme values
 */
const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  summaryCard: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  portfolioValue: {
    fontSize: theme.typography.fontSize.xxl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
  },
  chartCard: {
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.md,
    alignItems: 'center',
  },
  timeframeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  timeframeButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  selectedTimeframe: {
    backgroundColor: theme.colors.brand.primary,
  },
  timeframeText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.primary,
  },
  selectedTimeframeText: {
    color: theme.colors.text.inverse,
  },
  errorCard: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.status.errorLight,
  },
  errorText: {
    color: theme.colors.status.error,
    fontSize: theme.typography.fontSize.sm,
  },
});

export default InvestmentDetailScreen;