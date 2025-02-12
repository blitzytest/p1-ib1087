import React, { useMemo } from 'react';
import { 
  TouchableOpacity, 
  Text, 
  ActivityIndicator, 
  StyleSheet, 
  ViewStyle, 
  TextStyle,
  StyleProp 
} from 'react-native'; // ^0.71+
import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../types/theme';

// Button variants for different contexts
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

// Button sizes for different use cases
export type ButtonSize = 'small' | 'medium' | 'large';

// Comprehensive props interface
interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
  isRTL?: boolean;
  onAccessibilityTap?: () => void;
  minTouchSize?: number;
}

// Minimum touch target size for accessibility (44x44 as per WCAG)
const MIN_TOUCH_SIZE = 44;

/**
 * Generates optimized button container styles based on variant, size, and state
 */
const getButtonStyles = (
  theme: Theme,
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'medium',
  disabled: boolean = false,
  isRTL: boolean = false
): StyleProp<ViewStyle> => {
  const { colors, spacing, breakpoints } = theme;

  // Base styles
  const baseStyles: ViewStyle = {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.sm,
    minWidth: MIN_TOUCH_SIZE,
    minHeight: MIN_TOUCH_SIZE,
    opacity: disabled ? 0.5 : 1,
  };

  // Size-specific styles
  const sizeStyles: Record<ButtonSize, ViewStyle> = {
    small: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    medium: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    large: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
  };

  // Variant-specific styles
  const variantStyles: Record<ButtonVariant, ViewStyle> = {
    primary: {
      backgroundColor: colors.brand.primary,
      ...theme.shadows.medium,
    },
    secondary: {
      backgroundColor: colors.brand.secondary,
      ...theme.shadows.low,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.brand.primary,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
  };

  return [baseStyles, sizeStyles[size], variantStyles[variant]];
};

/**
 * Generates optimized label styles based on variant, size, and state
 */
const getLabelStyles = (
  theme: Theme,
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'medium',
  disabled: boolean = false,
  isRTL: boolean = false
): StyleProp<TextStyle> => {
  const { colors, typography } = theme;

  // Base text styles
  const baseStyles: TextStyle = {
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: typography.fontFamily.medium,
    color: colors.text.inverse,
  };

  // Size-specific text styles
  const sizeStyles: Record<ButtonSize, TextStyle> = {
    small: {
      fontSize: typography.fontSize.sm,
      lineHeight: typography.lineHeight.sm,
    },
    medium: {
      fontSize: typography.fontSize.md,
      lineHeight: typography.lineHeight.md,
    },
    large: {
      fontSize: typography.fontSize.lg,
      lineHeight: typography.lineHeight.lg,
    },
  };

  // Variant-specific text styles
  const variantStyles: Record<ButtonVariant, TextStyle> = {
    primary: {
      color: colors.text.inverse,
    },
    secondary: {
      color: colors.text.inverse,
    },
    outline: {
      color: colors.brand.primary,
    },
    ghost: {
      color: colors.brand.primary,
    },
  };

  return [baseStyles, sizeStyles[size], variantStyles[variant]];
};

/**
 * Button component with comprehensive styling and behavior options
 */
export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  labelStyle,
  accessibilityLabel,
  testID,
  isRTL = false,
  onAccessibilityTap,
  minTouchSize = MIN_TOUCH_SIZE,
}) => {
  const { theme } = useTheme();

  // Memoize styles for performance
  const buttonStyles = useMemo(
    () => getButtonStyles(theme, variant, size, disabled, isRTL),
    [theme, variant, size, disabled, isRTL]
  );

  const textStyles = useMemo(
    () => getLabelStyles(theme, variant, size, disabled, isRTL),
    [theme, variant, size, disabled, isRTL]
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[buttonStyles, style]}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
      accessibilityState={{
        disabled: disabled || loading,
        busy: loading,
      }}
      testID={testID}
      onAccessibilityTap={onAccessibilityTap}
      hitSlop={{
        top: Math.max(0, (minTouchSize - MIN_TOUCH_SIZE) / 2),
        bottom: Math.max(0, (minTouchSize - MIN_TOUCH_SIZE) / 2),
        left: Math.max(0, (minTouchSize - MIN_TOUCH_SIZE) / 2),
        right: Math.max(0, (minTouchSize - MIN_TOUCH_SIZE) / 2),
      }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'secondary' 
            ? theme.colors.text.inverse 
            : theme.colors.brand.primary}
        />
      ) : (
        <Text style={[textStyles, labelStyle]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};

// Optimize static styles
const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});

export default Button;