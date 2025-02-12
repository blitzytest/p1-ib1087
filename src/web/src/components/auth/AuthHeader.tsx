import React, { useMemo } from 'react';
import { StyleSheet, View, Text, Image, ImageSourcePropType, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../types/theme';

/**
 * Props interface for the AuthHeader component
 */
interface AuthHeaderProps {
  /** Main title text displayed below logo */
  title: string;
  /** Optional subtitle text displayed below title */
  subtitle?: string;
  /** Optional custom styles for container */
  style?: ViewStyle;
  /** Optional custom logo source */
  logoSource?: ImageSourcePropType;
  /** Optional test ID for testing */
  testID?: string;
}

/**
 * AuthHeader component displays a consistent header for authentication screens
 * including app logo, title and optional subtitle with theme-based styling
 */
const AuthHeader: React.FC<AuthHeaderProps> = ({
  title,
  subtitle,
  style,
  logoSource = require('../../assets/images/logo.png'),
  testID = 'auth-header'
}) => {
  // Get current theme
  const { theme } = useTheme();

  // Memoize styles to prevent unnecessary recalculation
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View 
      style={[styles.container, style]}
      testID={testID}
      accessibilityRole="header"
    >
      <Image
        source={logoSource}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="App logo"
        testID={`${testID}-logo`}
      />
      
      <Text
        style={styles.title}
        accessibilityRole="header"
        accessibilityLevel={1}
        testID={`${testID}-title`}
      >
        {title}
      </Text>

      {subtitle && (
        <Text
          style={styles.subtitle}
          accessibilityRole="text"
          testID={`${testID}-subtitle`}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
};

/**
 * Creates memoized styles for the AuthHeader component using theme values
 */
const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    backgroundColor: theme.colors.background.primary,
    width: '100%',
    maxWidth: theme.breakpoints.tablet,
    alignSelf: 'center'
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: theme.spacing.lg
  },
  title: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.fontSize.xxl,
    lineHeight: theme.typography.lineHeight.xxl,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: subtitle ? theme.spacing.sm : 0
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.fontSize.md,
    lineHeight: theme.typography.lineHeight.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    opacity: 0.8,
    maxWidth: '80%'
  }
});

export default AuthHeader;