/**
 * @fileoverview Main theme configuration for the Mint Clone mobile application
 * Combines colors, typography, spacing, and breakpoints into a unified theme object
 * that implements the Theme interface and extends React Navigation's DefaultTheme
 * @version 1.0.0
 */

import { DefaultTheme } from '@react-navigation/native'; // ^6.0.0
import { Theme } from '../types/theme';
import * as colors from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

// Breakpoint definitions based on standard device sizes
const BREAKPOINTS = {
  mobileS: 320,
  mobileL: 425,
  tablet: 768,
  desktop: 1024,
} as const;

/**
 * Creates the unified theme object implementing Theme interface
 * Combines all theme aspects into a single, consistent configuration
 * 
 * @returns {Theme} Complete theme configuration
 */
const createTheme = (): Theme => {
  // Combine all color definitions
  const themeColors = {
    brand: colors.brand,
    text: colors.text,
    background: colors.background,
    status: colors.status,
    chart: colors.chart,
    border: colors.border,
    shadow: colors.shadow,
  };

  // Create complete theme object
  const theme: Theme = {
    // Extend React Navigation's DefaultTheme
    ...DefaultTheme,
    
    // Custom theme properties
    colors: themeColors,
    typography,
    spacing: {
      xs: spacing.xs,
      sm: spacing.sm,
      md: spacing.md,
      lg: spacing.lg,
      xl: spacing.xl,
      xxl: spacing.xl * 1.5, // 48px
    },
    breakpoints: BREAKPOINTS,

    // Override React Navigation's default colors with our theme colors
    dark: false,
    colors: {
      ...DefaultTheme.colors,
      primary: themeColors.brand.primary,
      background: themeColors.background.primary,
      card: themeColors.background.card,
      text: themeColors.text.primary,
      border: themeColors.border.light,
      notification: themeColors.status.info,
    },
  };

  return theme;
};

// Create and memoize the theme object
export const theme = createTheme();

// Export individual theme aspects for direct usage
export const {
  colors: themeColors,
  typography: themeTypography,
  spacing: themeSpacing,
  breakpoints: themeBreakpoints,
} = theme;

// Type export for theme customization
export type AppTheme = typeof theme;