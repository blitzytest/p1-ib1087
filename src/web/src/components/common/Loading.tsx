import React from 'react'; // ^18.0.0
import { ActivityIndicator, StyleSheet, View } from 'react-native'; // 0.71+
import { useTheme } from '../../hooks/useTheme';

/**
 * Props interface for the Loading component with comprehensive customization options
 */
interface LoadingProps {
  /**
   * Controls the size of the loading indicator
   * @default 'small'
   */
  size?: 'small' | 'large';

  /**
   * Custom color for the loading indicator
   * Falls back to theme primary color if not provided
   */
  color?: string;

  /**
   * Enables fullscreen overlay mode with semi-transparent background
   * @default false
   */
  fullscreen?: boolean;

  /**
   * Accessibility label for screen readers
   * @default 'Loading'
   */
  accessibilityLabel?: string;
}

/**
 * A reusable loading spinner component that provides visual feedback during
 * asynchronous operations with theme integration and accessibility support.
 */
export const Loading: React.FC<LoadingProps> = ({
  size = 'small',
  color,
  fullscreen = false,
  accessibilityLabel = 'Loading'
}) => {
  // Get theme for consistent styling
  const { theme } = useTheme();

  // Create container style based on fullscreen prop
  const containerStyle = [
    styles.container,
    fullscreen && {
      ...styles.fullscreen,
      backgroundColor: `${theme.colors.background.overlay}`
    }
  ];

  // Use provided color or fall back to theme primary
  const spinnerColor = color || theme.colors.brand.primary;

  return (
    <View 
      style={containerStyle}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator
        size={size}
        color={spinnerColor}
        accessibilityElementsHidden={false}
        importantForAccessibility="yes"
      />
    </View>
  );
};

/**
 * Styles for the Loading component
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 5
  }
});
```

This implementation:

1. Provides a fully customizable loading spinner with theme integration
2. Supports both inline and fullscreen overlay modes
3. Implements comprehensive accessibility features
4. Uses React Native's ActivityIndicator for platform-specific rendering
5. Integrates with the application's theme system for consistent styling
6. Includes detailed TypeScript types and documentation
7. Follows the project's styling patterns and conventions
8. Supports performance optimization through minimal re-renders
9. Implements proper z-indexing and elevation for overlay mode
10. Provides fallback values for all optional props

The component can be used in both simple and complex scenarios:

Simple usage:
```typescript
<Loading />
```

Complex usage:
```typescript
<Loading 
  size="large"
  color="#00A6A4"
  fullscreen={true}
  accessibilityLabel="Loading your financial data"
/>