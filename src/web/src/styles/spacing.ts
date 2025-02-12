/**
 * @fileoverview Defines the spacing constants and scale for consistent component spacing and layout
 * throughout the mobile application. Implements a standardized spacing system based on an 8px grid.
 */

// Base spacing unit of 8px following standard mobile design principles
const BASE_SPACING_UNIT = 8 as const;

/**
 * Calculates spacing values based on the base unit multiplier.
 * Ensures consistent spacing throughout the application.
 * 
 * @param multiplier - Number to multiply with the base spacing unit
 * @returns Calculated spacing value in pixels
 * @throws Error if multiplier is not a positive number
 */
export const calculateSpacing = (multiplier: number): number => {
  if (multiplier <= 0 || !Number.isFinite(multiplier)) {
    throw new Error('Spacing multiplier must be a positive number');
  }
  return BASE_SPACING_UNIT * multiplier;
};

/**
 * Standardized spacing values following a consistent scale.
 * Uses half steps for fine-grained control (xs) up to 4x base unit (xl).
 */
export const spacing = {
  xs: calculateSpacing(0.5), // 4px
  sm: calculateSpacing(1),   // 8px
  md: calculateSpacing(2),   // 16px
  lg: calculateSpacing(3),   // 24px
  xl: calculateSpacing(4),   // 32px
} as const;

// Type definition for spacing values
export type SpacingKeys = keyof typeof spacing;