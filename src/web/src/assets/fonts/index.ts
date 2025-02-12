import { Platform } from 'react-native'; // v0.71+

// Type definitions for font families and weights
type FontFamily = 'regular' | 'medium' | 'bold';
type FontWeight = '400' | '500' | '700';

// Platform-specific font assets configuration
const FONT_ASSETS = {
  ios: {
    regular: 'San Francisco',
    medium: 'San Francisco-Medium',
    bold: 'San Francisco-Bold'
  },
  android: {
    regular: 'Roboto',
    medium: 'Roboto-Medium',
    bold: 'Roboto-Bold'
  }
};

// Standardized font weights mapping
const FONT_WEIGHTS = {
  regular: '400',
  medium: '500',
  bold: '700'
} as const;

/**
 * Returns the platform-specific font family name based on the requested weight
 * @param weight - The desired font weight ('regular', 'medium', 'bold')
 * @returns Platform-specific font family name
 */
export const getFontFamily = (weight: FontFamily): string => {
  const platform = Platform.OS;
  
  // Get platform-specific font assets
  const platformFonts = FONT_ASSETS[platform as keyof typeof FONT_ASSETS];
  
  if (!platformFonts) {
    // Fallback to system default if platform not supported
    return platform === 'ios' ? 'System' : 'Roboto';
  }

  // Return font family for requested weight
  return platformFonts[weight] || platformFonts.regular;
};

// Export font family configuration object
export const fonts = {
  regular: getFontFamily('regular'),
  medium: getFontFamily('medium'),
  bold: getFontFamily('bold')
} as const;

// Export font weights configuration object
export const weights = {
  regular: FONT_WEIGHTS.regular,
  medium: FONT_WEIGHTS.medium,
  bold: FONT_WEIGHTS.bold
} as const;