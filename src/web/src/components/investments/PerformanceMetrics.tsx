import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, Animated, Platform } from 'react-native'; // 0.71+
import Card from '../common/Card';
import { Investment } from '../../types/models';
import { chart } from '../../styles/colors';
import { useTheme } from '../../hooks/useTheme';

/**
 * Props interface for the PerformanceMetrics component
 */
interface PerformanceMetricsProps {
  investments: Investment[];
  timeframe: '1D' | '1W' | '1M' | 'YTD';
  isLoading?: boolean;
  onError?: (error: Error) => void;
  testID?: string;
}

/**
 * Interface for calculated performance metrics
 */
interface PerformanceData {
  value: number;
  percentage: number;
  isPositive: boolean;
  timestamp: Date;
  confidence: number;
}

/**
 * A component that displays investment performance metrics with animations and responsive layout
 */
const PerformanceMetrics: React.FC<PerformanceMetricsProps> = React.memo(({
  investments,
  timeframe,
  isLoading = false,
  onError,
  testID = 'performance-metrics'
}) => {
  const { theme } = useTheme();

  // Animation value for fade-in effect
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  /**
   * Memoized function to calculate performance metrics
   */
  const calculatePerformance = useCallback((
    investments: Investment[],
    timeframe: string
  ): PerformanceData => {
    try {
      if (!investments.length) {
        return {
          value: 0,
          percentage: 0,
          isPositive: true,
          timestamp: new Date(),
          confidence: 1
        };
      }

      // Get current total value
      const currentTotal = investments.reduce((sum, inv) => sum + inv.value, 0);

      // Calculate historical value based on timeframe
      const timeframeMap = {
        '1D': 1,
        '1W': 7,
        '1M': 30,
        'YTD': new Date().getMonth() + 1
      };

      const daysToSubtract = timeframeMap[timeframe as keyof typeof timeframeMap];
      const historicalDate = new Date();
      historicalDate.setDate(historicalDate.getDate() - daysToSubtract);

      // Filter investments by timeframe
      const historicalInvestments = investments.filter(
        inv => inv.lastUpdated <= historicalDate
      );

      const historicalTotal = historicalInvestments.reduce(
        (sum, inv) => sum + inv.value,
        0
      );

      // Calculate value and percentage change
      const valueChange = currentTotal - historicalTotal;
      const percentageChange = historicalTotal !== 0
        ? (valueChange / historicalTotal) * 100
        : 0;

      return {
        value: valueChange,
        percentage: Number(percentageChange.toFixed(2)),
        isPositive: valueChange >= 0,
        timestamp: new Date(),
        confidence: historicalInvestments.length / investments.length
      };
    } catch (error) {
      onError?.(error as Error);
      return {
        value: 0,
        percentage: 0,
        isPositive: true,
        timestamp: new Date(),
        confidence: 0
      };
    }
  }, [onError]);

  /**
   * Format currency with proper localization
   */
  const formatCurrency = useCallback((value: number): string => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    const formattedValue = formatter.format(Math.abs(value));
    return value >= 0 ? `+${formattedValue}` : `-${formattedValue}`;
  }, []);

  // Calculate performance metrics
  const performance = useMemo(() => 
    calculatePerformance(investments, timeframe),
    [investments, timeframe, calculatePerformance]
  );

  // Handle animation on mount and updates
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start();

    return () => {
      fadeAnim.setValue(0);
    };
  }, [fadeAnim, performance]);

  // Memoized styles
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Card
      testID={testID}
      style={styles.container}
      accessible={true}
      accessibilityLabel={`Performance metrics for ${timeframe} timeframe`}
    >
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.metricRow}>
          <Text style={styles.timeframe}>{timeframe} Performance</Text>
          {performance.confidence < 0.8 && (
            <Text style={styles.confidenceWarning}>Limited data available</Text>
          )}
        </View>

        <View style={styles.metricsContainer}>
          <Text
            style={[
              styles.value,
              performance.isPositive ? styles.positive : styles.negative
            ]}
            accessibilityLabel={`Value change ${formatCurrency(performance.value)}`}
          >
            {formatCurrency(performance.value)}
          </Text>

          <Text
            style={[
              styles.percentage,
              performance.isPositive ? styles.positive : styles.negative
            ]}
            accessibilityLabel={`Percentage change ${performance.percentage}%`}
          >
            {performance.isPositive ? '+' : '-'}{Math.abs(performance.percentage)}%
          </Text>
        </View>

        {isLoading && (
          <View style={styles.loadingOverlay} testID="loading-indicator">
            <Text style={styles.loadingText}>Updating...</Text>
          </View>
        )}
      </Animated.View>
    </Card>
  );
});

/**
 * Styles creator function using theme values
 */
const createStyles = (theme: any) => StyleSheet.create({
  container: {
    marginVertical: theme.spacing.sm,
  },
  content: {
    padding: theme.spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  timeframe: {
    ...Platform.select({
      web: { cursor: 'default' },
    }),
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.text.primary,
  },
  confidenceWarning: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.status.warning,
  },
  metricsContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.md,
  },
  value: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.bold,
  },
  percentage: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.medium,
  },
  positive: {
    color: chart.positive,
  },
  negative: {
    color: chart.negative,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
  },
});

export default PerformanceMetrics;