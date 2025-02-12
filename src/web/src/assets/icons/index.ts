/**
 * Icon Assets Index
 * Centralizes and exports icon assets used throughout the Mint Clone mobile application
 * @version 1.0.0
 */

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'; // v9.0.0

/**
 * Standard icon size variants used across the application
 */
export const ICON_SIZE = {
  SMALL: 16,
  MEDIUM: 24,
  LARGE: 32,
} as const;

/**
 * Returns standardized icon size based on variant
 * @param variant - Size variant ('SMALL' | 'MEDIUM' | 'LARGE')
 * @returns Icon size in pixels
 * @throws Error if invalid variant provided
 */
export const getIconSize = (variant: keyof typeof ICON_SIZE): number => {
  if (variant in ICON_SIZE) {
    return ICON_SIZE[variant];
  }
  throw new Error(`Invalid icon size variant: ${variant}`);
};

/**
 * Navigation-related icons used in headers and tab bars
 */
export const NavigationIcons = {
  dashboard: 'view-dashboard',
  menu: 'menu',
  back: 'chevron-left',
  forward: 'chevron-right',
  profile: 'account-circle',
  help: 'help-circle',
} as const;

/**
 * Action-related icons used in buttons and interactive elements
 */
export const ActionIcons = {
  add: 'plus-circle',
  close: 'close',
  delete: 'delete',
  upload: 'upload',
  favorite: 'star',
} as const;

/**
 * Financial feature-related icons used across the application
 */
export const FinancialIcons = {
  transaction: 'cash',
  alert: 'alert-circle',
  budget: 'chart-pie',
  investment: 'trending-up',
  account: 'bank',
} as const;

// Type definitions for icon names
export type NavigationIconName = keyof typeof NavigationIcons;
export type ActionIconName = keyof typeof ActionIcons;
export type FinancialIconName = keyof typeof FinancialIcons;

// Re-export MaterialCommunityIcons for direct usage
export { MaterialCommunityIcons };