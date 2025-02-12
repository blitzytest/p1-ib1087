/**
 * Central export point for all TypeScript type definitions used in the Mint Clone application
 * Provides comprehensive type safety and cross-platform compatibility
 * @version 1.0.0
 */

// API Types
export type {
  ApiResponse,
  ApiError,
  LoginRequest,
  AuthResponse,
  PlaidLinkMetadata,
  PlaidLinkRequest,
  TransactionFilters,
  BudgetRequest,
  InvestmentFilters,
  ApiAxiosResponse
} from './api';

export {
  SortOrder,
  BudgetPeriod,
  NotificationPreference,
  TimeRange,
  AggregationType
} from './api';

// Domain Models
export type {
  UserPreferences,
  NotificationSettings,
  User,
  InstitutionInfo,
  Account
} from './models';

export {
  AccountType,
  AccountStatus
} from './models';

// Navigation Types
export type {
  // Stack Param Lists
  RootStackParamList,
  AuthStackParamList,
  MainTabParamList,
  AccountStackParamList,
  BudgetStackParamList,
  InvestmentStackParamList,
  ProfileStackParamList,
  
  // Navigation Props
  RootStackNavigationProp,
  AuthStackNavigationProp,
  MainTabNavigationProp,
  AccountStackNavigationProp,
  BudgetStackNavigationProp,
  InvestmentStackNavigationProp,
  ProfileStackNavigationProp,
  
  // Route Props
  RootStackRouteProp,
  AuthStackRouteProp,
  MainTabRouteProp,
  AccountStackRouteProp,
  BudgetStackRouteProp,
  InvestmentStackRouteProp,
  ProfileStackRouteProp
} from './navigation';

// Theme Types
export type {
  Theme,
  ColorTheme,
  TypographyTheme,
  SpacingTheme,
  BreakpointsTheme
} from './theme';

// Utility Types

/**
 * Responsive style type supporting different breakpoints
 */
export type ResponsiveStyle<T> = {
  base: T;
  mobileS?: Partial<T>;
  mobileL?: Partial<T>;
  tablet?: Partial<T>;
  desktop?: Partial<T>;
};

/**
 * Device breakpoint type
 */
export type Breakpoint = 'mobileS' | 'mobileL' | 'tablet' | 'desktop';

/**
 * Platform-specific style type
 */
export type PlatformStyle<T> = {
  ios: T;
  android: T;
  default: T;
};

/**
 * Deep partial utility type for theme customization
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Theme variant type for supporting multiple theme configurations
 */
export type ThemeVariant = 'light' | 'dark' | 'system';

/**
 * Animation configuration type
 */
export type AnimationConfig = {
  duration: number;
  easing: 'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  delay?: number;
};

/**
 * Error boundary fallback props type
 */
export interface ErrorBoundaryProps {
  error: Error;
  resetError: () => void;
}

/**
 * Toast notification type
 */
export interface ToastConfig {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  position?: 'top' | 'bottom';
  action?: {
    label: string;
    onPress: () => void;
  };
}

/**
 * Form validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Analytics event type
 */
export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp?: Date;
}