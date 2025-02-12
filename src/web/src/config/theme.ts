/**
 * @fileoverview Main theme configuration for Mint Clone mobile application
 * Combines colors, typography, spacing, and breakpoints into a unified theme system
 * with support for financial data visualization and cross-platform consistency
 * @version 1.0.0
 */

import { DefaultTheme } from '@react-navigation/native'; // ^6.0.0
import { Theme } from '../types/theme';
import { colors, brand, text, background, status, chart, border, shadow } from '../styles/colors';
import { typography } from '../styles/typography';
import { spacing } from '../styles/spacing';

/**
 * Shadow configuration for different elevation levels
 * Provides consistent depth perception across platforms
 */
const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  low: {
    shadowColor: shadow.light,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: shadow.medium,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  high: {
    shadowColor: shadow.dark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

/**
 * Breakpoint configuration for responsive design
 * Matches design specifications for different device sizes
 */
const breakpoints = {
  mobileS: 320,
  mobileM: 375,
  mobileL: 425,
  tabletS: 768,
  tabletL: 900,
  desktop: 1024,
  desktopL: 1440,
  portrait: '(orientation: portrait)',
  landscape: '(orientation: landscape)',
} as const;

/**
 * Creates the main theme object implementing the Theme interface
 * Combines all style configurations into a unified theme system
 */
const createTheme = (): Theme => ({
  // Color system
  colors: {
    brand: {
      primary: brand.primary,
      secondary: brand.secondary,
      accent: brand.accent,
      highlight: brand.accent,
      muted: text.tertiary,
    },
    text: {
      primary: text.primary,
      secondary: text.secondary,
      tertiary: text.tertiary,
      inverse: text.inverse,
      disabled: text.tertiary,
      link: brand.primary,
      error: status.error,
      success: status.success,
    },
    background: {
      primary: background.primary,
      secondary: background.secondary,
      tertiary: background.tertiary,
      card: background.card,
      modal: background.modal,
      overlay: 'rgba(0, 0, 0, 0.5)',
      input: background.primary,
      disabled: background.secondary,
    },
    status: {
      success: status.success,
      warning: status.warning,
      error: status.error,
      info: status.info,
      successLight: `${status.success}20`,
      warningLight: `${status.warning}20`,
      errorLight: `${status.error}20`,
      infoLight: `${status.info}20`,
    },
    chart: {
      primary: chart.primary,
      secondary: chart.secondary,
      tertiary: chart.tertiary,
      positive: chart.positive,
      negative: chart.negative,
      neutral: text.tertiary,
      gradient1: brand.primary,
      gradient2: brand.secondary,
    },
    border: {
      primary: border.medium,
      secondary: border.light,
      focus: brand.primary,
      error: status.error,
      success: status.success,
    },
    shadow: {
      light: shadow.light,
      medium: shadow.medium,
      dark: shadow.dark,
    },
  },

  // Typography system
  typography,

  // Spacing system
  spacing: {
    xs: spacing.xs,
    sm: spacing.sm,
    md: spacing.md,
    lg: spacing.lg,
    xl: spacing.xl,
    xxl: spacing.xl * 1.5, // 48px
  },

  // Breakpoint system
  breakpoints: {
    mobileS: breakpoints.mobileS,
    mobileL: breakpoints.mobileL,
    tablet: breakpoints.tabletS,
    desktop: breakpoints.desktop,
  },

  // Shadow system
  shadows,

  // Navigation theme integration (extending DefaultTheme)
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: brand.primary,
    background: background.primary,
    card: background.card,
    text: text.primary,
    border: border.light,
    notification: status.info,
  },
});

/**
 * Memoized theme object for performance optimization
 * Exports the complete theme configuration for use throughout the application
 */
export const theme = createTheme();

// Type export for theme usage
export type AppTheme = typeof theme;