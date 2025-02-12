import React from 'react'; // ^18.0.0
import { View, Text, StyleSheet, Animated } from 'react-native'; // 0.71+
import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../types/theme';

interface AlertProps {
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  visible: boolean;
  duration?: number;
  onDismiss?: () => void;
  testID?: string;
}

const Alert = React.memo(({
  message,
  type,
  visible,
  duration = 5000,
  onDismiss,
  testID
}: AlertProps) => {
  const { theme } = useTheme();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    let dismissTimer: NodeJS.Timeout;

    if (visible) {
      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Auto dismiss after duration
      if (duration > 0) {
        dismissTimer = setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onDismiss?.();
          });
        }, duration);
      }
    } else {
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (dismissTimer) {
        clearTimeout(dismissTimer);
      }
    };
  }, [visible, duration, fadeAnim, onDismiss]);

  const getAlertStyles = React.useCallback((type: AlertProps['type'], theme: Theme) => {
    const baseStyles = {
      backgroundColor: theme.colors.status[`${type}Light`],
      borderColor: theme.colors.status[type],
    };

    return baseStyles;
  }, []);

  const getAccessibilityProps = React.useCallback((type: AlertProps['type']) => {
    const roleMap = {
      success: 'alert',
      warning: 'alert',
      error: 'alert',
      info: 'status',
    };

    return {
      role: roleMap[type],
      accessibilityLive: 'polite' as 'polite',
      accessibilityLabel: `${type} alert: ${message}`,
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        getAlertStyles(type, theme),
        { opacity: fadeAnim }
      ]}
      testID={testID}
      {...getAccessibilityProps(type)}
    >
      <Text
        style={[
          styles.message,
          { color: theme.colors.status[type] }
        ]}
        numberOfLines={2}
      >
        {message}
      </Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 1000,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

Alert.displayName = 'Alert';

export default Alert;