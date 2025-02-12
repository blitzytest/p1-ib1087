import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, AccessibilityInfo, ViewStyle } from 'react-native'; // 0.71+
import { useTheme } from '../../hooks/useTheme';
import { analytics } from '@analytics/react'; // ^0.1.0

// Error severity levels and their corresponding accessibility roles
const ERROR_SEVERITY = {
  error: 'alert',
  warning: 'alert',
  info: 'status',
  success: 'status',
} as const;

// Default maximum retry attempts
const DEFAULT_MAX_RETRIES = 3;

interface ErrorProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  severity?: keyof typeof ERROR_SEVERITY;
  style?: ViewStyle;
  errorCode?: string;
  maxRetries?: number;
  showErrorBoundary?: boolean;
  onErrorReport?: () => void;
  analyticsData?: Record<string, any>;
}

export const Error: React.FC<ErrorProps> = ({
  message,
  title,
  onRetry,
  severity = 'error',
  style,
  errorCode,
  maxRetries = DEFAULT_MAX_RETRIES,
  showErrorBoundary = false,
  onErrorReport,
  analyticsData = {},
}) => {
  const { theme } = useTheme();
  const [retryCount, setRetryCount] = useState(0);

  // Track error occurrence
  React.useEffect(() => {
    analytics.track('Error_Displayed', {
      errorCode,
      severity,
      message,
      retryCount,
      ...analyticsData,
    });
  }, [errorCode, severity, message, retryCount, analyticsData]);

  // Handle retry attempts
  const handleRetry = useCallback(() => {
    if (retryCount < maxRetries && onRetry) {
      setRetryCount(prev => prev + 1);
      analytics.track('Error_Retry_Attempted', {
        errorCode,
        retryCount: retryCount + 1,
        maxRetries,
      });
      onRetry();
    }
  }, [retryCount, maxRetries, onRetry, errorCode]);

  // Handle error reporting
  const handleErrorReport = useCallback(() => {
    if (onErrorReport) {
      analytics.track('Error_Report_Submitted', {
        errorCode,
        severity,
        retryAttempts: retryCount,
      });
      onErrorReport();
    }
  }, [onErrorReport, errorCode, severity, retryCount]);

  // Set accessibility focus on mount
  React.useEffect(() => {
    if (showErrorBoundary) {
      AccessibilityInfo.announceForAccessibility(
        `${severity} alert: ${title ? title + '. ' : ''}${message}`
      );
    }
  }, [showErrorBoundary, severity, title, message]);

  const styles = StyleSheet.create({
    container: {
      padding: theme.spacing.md,
      borderRadius: 8,
      backgroundColor: theme.colors.background.secondary,
      borderWidth: 1,
      borderColor: theme.colors.status[severity],
      accessibilityRole: ERROR_SEVERITY[severity],
      ...style,
    },
    title: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.fontSize.md,
      marginBottom: theme.spacing.xs,
      color: theme.colors.status[severity],
    },
    message: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
    },
    errorCode: {
      fontFamily: theme.typography.fontFamily.mono,
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.text.tertiary,
      marginTop: theme.spacing.xs,
    },
    retryButton: {
      marginTop: theme.spacing.md,
      alignSelf: 'flex-start',
      opacity: retryCount < maxRetries ? 1 : 0.5,
    },
    retryText: {
      color: theme.colors.brand.primary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.fontSize.sm,
    },
    reportButton: {
      marginTop: theme.spacing.sm,
      alignSelf: 'flex-start',
    },
    reportText: {
      color: theme.colors.text.tertiary,
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.xs,
    },
  });

  return (
    <View 
      style={styles.container}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${severity} alert: ${title || message}`}
    >
      {title && (
        <Text 
          style={styles.title}
          accessibilityRole="header"
        >
          {title}
        </Text>
      )}
      <Text style={styles.message}>
        {message}
      </Text>
      {errorCode && (
        <Text style={styles.errorCode}>
          Error Code: {errorCode}
        </Text>
      )}
      {onRetry && retryCount < maxRetries && (
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={handleRetry}
          accessibilityRole="button"
          accessibilityLabel={`Retry. Attempt ${retryCount + 1} of ${maxRetries}`}
        >
          <Text style={styles.retryText}>
            Retry
          </Text>
        </TouchableOpacity>
      )}
      {onErrorReport && (
        <TouchableOpacity 
          style={styles.reportButton}
          onPress={handleErrorReport}
          accessibilityRole="button"
          accessibilityLabel="Report this error"
        >
          <Text style={styles.reportText}>
            Report this error
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default Error;