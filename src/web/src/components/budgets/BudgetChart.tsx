import React, { useCallback, useEffect, useRef, memo } from 'react';
import { Animated, View, StyleSheet, useWindowDimensions } from 'react-native';
import styled from 'styled-components';
import { colors } from '../../styles/colors';

/**
 * Props interface for the BudgetChart component
 * @version 1.0.0
 */
interface BudgetChartProps {
  /** Current amount spent in budget category */
  spent: number;
  /** Total budget amount allocated */
  total: number;
  /** Percentage threshold for warning status (0-100) */
  alertThreshold: number;
  /** Optional custom styles for container */
  style?: ViewStyle;
  /** Optional flag to respect reduced motion preferences */
  reduceMotion?: boolean;
  /** Custom accessibility label for screen readers */
  accessibilityLabel?: string;
}

/**
 * Styled container for the budget progress chart
 */
const ChartContainer = styled(View)`
  height: 12px;
  background-color: ${colors.chart.secondary}20;
  border-radius: 6px;
  overflow: hidden;
  shadow-color: ${colors.shadow.light};
  shadow-offset: 0px 2px;
  shadow-opacity: 0.1;
  shadow-radius: 2px;
  elevation: 2;
`;

/**
 * Styled animated progress bar
 */
const ProgressBar = styled(Animated.View)`
  height: 100%;
  border-radius: 6px;
  position: absolute;
  left: 0;
  right: 0;
`;

/**
 * Calculates the appropriate color for the progress bar based on spending percentage
 * @param percentage - Current spending percentage (0-100)
 * @param threshold - Alert threshold percentage (0-100)
 * @returns WCAG-compliant color code
 */
const calculateProgressColor = (percentage: number, threshold: number): string => {
  if (percentage >= 100) {
    return colors.status.error;
  }
  if (percentage >= threshold) {
    return colors.status.warning;
  }
  return colors.status.success;
};

/**
 * BudgetChart component renders an accessible, animated progress bar for budget tracking
 * @version 1.0.0
 */
const BudgetChart: React.FC<BudgetChartProps> = memo(({
  spent,
  total,
  alertThreshold,
  style,
  reduceMotion = false,
  accessibilityLabel,
}) => {
  // Animation configuration
  const progressAnim = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();

  // Calculate progress percentage
  const percentage = Math.min((spent / total) * 100, 100);
  const progressColor = calculateProgressColor(percentage, alertThreshold);

  // Configure animation
  const animateProgress = useCallback(() => {
    Animated.spring(progressAnim, {
      toValue: percentage / 100,
      useNativeDriver: true,
      tension: 20,
      friction: 7,
      velocity: 0.5,
      delay: 100,
      // Respect reduced motion preferences
      duration: reduceMotion ? 0 : undefined,
    }).start();
  }, [percentage, progressAnim, reduceMotion]);

  // Trigger animation on mount and updates
  useEffect(() => {
    animateProgress();
    // Cleanup animation on unmount
    return () => {
      progressAnim.stopAnimation();
    };
  }, [animateProgress]);

  // Transform progress value to width
  const progressStyle = {
    transform: [{
      scaleX: progressAnim,
    }],
    backgroundColor: progressColor,
  };

  // Generate accessibility label
  const defaultAccessibilityLabel = `Budget progress: ${Math.round(percentage)}% spent. ${
    percentage >= alertThreshold ? 'Warning: Approaching budget limit.' : ''
  }`;

  return (
    <ChartContainer
      style={style}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel || defaultAccessibilityLabel}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(percentage),
      }}
    >
      <ProgressBar
        style={progressStyle}
        accessibilityElementsHidden={true}
        importantForAccessibility="no-hide-descendants"
      />
    </ChartContainer>
  );
});

// Display name for debugging
BudgetChart.displayName = 'BudgetChart';

export default BudgetChart;