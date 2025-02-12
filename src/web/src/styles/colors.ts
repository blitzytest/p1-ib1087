/**
 * @fileoverview Color system definition for Mint Clone mobile application
 * Provides consistent color schemes across all components and screens
 * with support for accessibility and cross-platform compatibility
 * @version 1.0.0
 */

// Base color palette definition with semantic naming
const palette = {
  mint: '#00A6A4',
  mintDark: '#008F8C',
  mintLight: '#E5F7F7',
  navy: '#0B3954',
  slate: '#4F6D7A',
  cloud: '#F5F7F9',
  white: '#FFFFFF',
  black: '#000000',
  success: '#4CAF50',
  warning: '#FFC107',
  error: '#F44336',
  info: '#2196F3',
} as const;

/**
 * Primary brand colors used for main UI elements and brand identity
 */
export const brand = {
  primary: palette.mint,
  secondary: palette.navy,
  accent: palette.mintLight,
} as const;

/**
 * Text color variants for different typography hierarchy levels
 */
export const text = {
  primary: palette.navy,
  secondary: palette.slate,
  tertiary: '#6B7C85',
  inverse: palette.white,
} as const;

/**
 * Background colors for different surface types and containers
 */
export const background = {
  primary: palette.white,
  secondary: palette.cloud,
  tertiary: palette.mintLight,
  card: palette.white,
  modal: palette.white,
} as const;

/**
 * Status colors for user feedback and system states
 */
export const status = {
  success: palette.success,
  warning: palette.warning,
  error: palette.error,
  info: palette.info,
} as const;

/**
 * Chart colors for financial data visualization
 */
export const chart = {
  primary: palette.mint,
  secondary: palette.navy,
  tertiary: palette.slate,
  positive: palette.success,
  negative: palette.error,
} as const;

/**
 * Border colors for element separation and visual hierarchy
 */
export const border = {
  light: '#E1E8ED',
  medium: '#CBD5DC',
  dark: palette.slate,
} as const;

/**
 * Shadow colors for depth and elevation indication
 */
export const shadow = {
  light: 'rgba(0, 0, 0, 0.1)',
  medium: 'rgba(0, 0, 0, 0.15)',
  dark: 'rgba(0, 0, 0, 0.2)',
} as const;