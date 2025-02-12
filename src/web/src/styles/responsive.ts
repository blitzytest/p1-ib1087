import { Dimensions } from 'react-native'; // ^0.71.0
import { BreakpointsTheme } from '../types/theme';

/**
 * Breakpoint constants defining width thresholds for different device sizes
 * Based on common device dimensions and standard breakpoints
 */
export const BREAKPOINTS: BreakpointsTheme = {
  mobileS: 320, // Small mobile devices
  mobileL: 425, // Large mobile devices
  tablet: 768,  // Tablet devices
  desktop: 1024 // Desktop devices
};

/**
 * Retrieves current window dimensions with memoization for performance
 * @returns Object containing width, height, scale, and fontScale
 */
export const getWindowDimensions = () => {
  const { width, height, scale, fontScale } = Dimensions.get('window');
  return {
    width,
    height,
    scale,
    fontScale
  };
};

/**
 * Determines if current screen width falls within specified breakpoint range
 * @param breakpoint - Target breakpoint to check against ('mobileS' | 'mobileL' | 'tablet' | 'desktop')
 * @returns boolean indicating if screen matches breakpoint range
 */
export const isScreenSize = (breakpoint: keyof BreakpointsTheme): boolean => {
  const { width } = getWindowDimensions();
  const breakpoints = Object.entries(BREAKPOINTS);
  const breakpointIndex = breakpoints.findIndex(([key]) => key === breakpoint);

  // Handle edge cases
  if (breakpointIndex === 0) {
    return width < breakpoints[1][1];
  }
  if (breakpointIndex === breakpoints.length - 1) {
    return width >= breakpoints[breakpointIndex][1];
  }

  // Check if width falls within breakpoint range
  return width >= breakpoints[breakpointIndex][1] && 
         width < breakpoints[breakpointIndex + 1][1];
};

/**
 * Returns appropriate value based on current screen size with fallback chain
 * @param values - Object containing values for different breakpoints
 * @returns Value corresponding to current screen size
 */
export const getResponsiveValue = <T>(values: {
  mobileS?: T;
  mobileL?: T;
  tablet?: T;
  desktop?: T;
}): T => {
  const { width } = getWindowDimensions();
  const breakpoints = Object.entries(BREAKPOINTS);

  // Find matching breakpoint
  const matchingBreakpoint = breakpoints.reverse().find(([_, size]) => width >= size);
  
  if (!matchingBreakpoint) {
    // Default to mobileS if no match found
    return values.mobileS || values.mobileL || values.tablet || values.desktop as T;
  }

  const breakpointKey = matchingBreakpoint[0] as keyof BreakpointsTheme;
  
  // Return value with fallback chain
  switch (breakpointKey) {
    case 'desktop':
      return values.desktop || values.tablet || values.mobileL || values.mobileS as T;
    case 'tablet':
      return values.tablet || values.mobileL || values.mobileS as T;
    case 'mobileL':
      return values.mobileL || values.mobileS as T;
    case 'mobileS':
      return values.mobileS as T;
  }
};

/**
 * Calculates optimal number of columns for grid layout based on screen size
 * @returns Number of columns (1-3) based on current screen width
 */
export const getColumnCount = (): number => {
  const { width } = getWindowDimensions();

  if (width >= BREAKPOINTS.desktop) {
    return 3; // Desktop: 3 columns
  } else if (width >= BREAKPOINTS.tablet) {
    return 2; // Tablet: 2 columns
  } else {
    return 1; // Mobile: 1 column
  }
};