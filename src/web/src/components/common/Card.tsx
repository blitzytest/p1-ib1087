import React from 'react'; // ^18.0.0
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native'; // 0.71+
import { Theme } from '../../types/theme';
import { useTheme } from '../../hooks/useTheme';

/**
 * Props interface for the Card component
 */
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  disabled?: boolean;
  elevation?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  accessible?: boolean;
  containerStyle?: ViewStyle;
}

/**
 * A reusable card component that provides a consistent, themed container
 * for content display across the Mint Clone mobile application.
 */
const Card: React.FC<CardProps> = React.memo(({
  children,
  style,
  disabled = false,
  elevation = 1,
  onPress,
  accessibilityLabel,
  testID,
  accessible = true,
  containerStyle
}) => {
  // Get current theme
  const { theme } = useTheme();

  // Create memoized styles
  const styles = React.useMemo(() => createStyles(theme, elevation), [theme, elevation]);

  // Determine container component based on onPress prop
  const Container = onPress ? TouchableOpacity : View;

  // Merge custom styles with base styles
  const containerStyles = [
    styles.container,
    disabled && styles.disabled,
    style,
    containerStyle
  ];

  return (
    <Container
      style={containerStyles}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityState={{ disabled }}
      accessible={accessible}
      testID={testID}
    >
      {children}
    </Container>
  );
});

/**
 * Creates optimized stylesheet for card component using theme values
 */
const createStyles = (theme: Theme, elevation: number) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background.card,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    // Platform-specific shadows
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.shadow.medium,
        shadowOffset: { width: 0, height: elevation * 2 },
        shadowOpacity: 0.1 + (elevation * 0.05),
        shadowRadius: elevation * 2,
      },
      android: {
        elevation: elevation * 2,
      },
      web: {
        boxShadow: `0px ${elevation * 2}px ${elevation * 4}px ${theme.colors.shadow.medium}`,
      },
    }),
  },
  disabled: {
    backgroundColor: theme.colors.background.disabled,
    opacity: 0.7,
  },
});

// Export memoized component
export default Card;