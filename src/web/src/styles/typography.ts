import { TypographyTheme } from '../types/theme';

// Font family definitions with cross-platform fallbacks
const FONT_FAMILY = {
  regular: 'System',
  medium: 'System-Medium',
  bold: 'System-Bold',
  monospace: 'System-Mono',
  // Comprehensive fallback chain for cross-platform compatibility
  fallback: '-apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, Arial, sans-serif'
} as const;

// Font size scale with semantic naming
const FONT_SIZE = {
  xs: 12, // Small labels, captions
  sm: 14, // Secondary text, metadata
  md: 16, // Body text, primary content
  lg: 18, // Subheadings, emphasized content
  xl: 20, // Section headings
  xxl: 24, // Major headings
  display1: 32, // Hero text, primary headlines
  display2: 40, // Large display text
} as const;

// Font weights mapped to semantic names
const FONT_WEIGHT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700'
} as const;

// Line heights optimized for readability
const LINE_HEIGHT = {
  xs: 16, // 1.33 ratio for xs
  sm: 20, // 1.43 ratio for sm
  md: 24, // 1.5 ratio for md
  lg: 28, // 1.56 ratio for lg
  xl: 32, // 1.6 ratio for xl
  xxl: 36, // 1.5 ratio for xxl
  display1: 40, // 1.25 ratio for display1
  display2: 48, // 1.2 ratio for display2
} as const;

// Letter spacing configurations for different sizes
const LETTER_SPACING = {
  tight: '-0.02em',
  normal: '0em',
  wide: '0.02em',
  extraWide: '0.04em'
} as const;

/**
 * Creates a comprehensive typography configuration implementing the TypographyTheme interface
 * with support for dynamic scaling and accessibility
 * 
 * @returns {TypographyTheme} Complete typography configuration object
 */
const createTypography = (): TypographyTheme => {
  return {
    // Font families with fallback chains
    fontFamily: {
      regular: `${FONT_FAMILY.regular}, ${FONT_FAMILY.fallback}`,
      medium: `${FONT_FAMILY.medium}, ${FONT_FAMILY.fallback}`,
      bold: `${FONT_FAMILY.bold}, ${FONT_FAMILY.fallback}`,
      monospace: `${FONT_FAMILY.monospace}, monospace`
    },

    // Font sizes with dynamic scaling support
    fontSize: {
      xs: FONT_SIZE.xs,
      sm: FONT_SIZE.sm,
      md: FONT_SIZE.md,
      lg: FONT_SIZE.lg,
      xl: FONT_SIZE.xl,
      xxl: FONT_SIZE.xxl,
      display1: FONT_SIZE.display1,
      display2: FONT_SIZE.display2
    },

    // Font weights for different text styles
    fontWeight: {
      regular: FONT_WEIGHT.regular,
      medium: FONT_WEIGHT.medium,
      semibold: FONT_WEIGHT.semibold,
      bold: FONT_WEIGHT.bold
    },

    // Line heights optimized for readability
    lineHeight: {
      xs: LINE_HEIGHT.xs,
      sm: LINE_HEIGHT.sm,
      md: LINE_HEIGHT.md,
      lg: LINE_HEIGHT.lg,
      xl: LINE_HEIGHT.xl,
      xxl: LINE_HEIGHT.xxl,
      display1: LINE_HEIGHT.display1,
      display2: LINE_HEIGHT.display2
    }
  };
};

// Export the typography configuration
export const typography = createTypography();

// Export individual constants for direct usage
export {
  FONT_FAMILY,
  FONT_SIZE,
  FONT_WEIGHT,
  LINE_HEIGHT,
  LETTER_SPACING
};