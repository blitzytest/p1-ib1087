import { DefaultTheme } from '@react-navigation/native'; // ^6.0.0

// Brand Colors Interface
interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  highlight: string;
  muted: string;
}

// Text Colors Interface
interface TextColors {
  primary: string;
  secondary: string;
  tertiary: string;
  inverse: string;
  disabled: string;
  link: string;
  error: string;
  success: string;
}

// Background Colors Interface
interface BackgroundColors {
  primary: string;
  secondary: string;
  tertiary: string;
  card: string;
  modal: string;
  overlay: string;
  input: string;
  disabled: string;
}

// Status Colors Interface
interface StatusColors {
  success: string;
  warning: string;
  error: string;
  info: string;
  successLight: string;
  warningLight: string;
  errorLight: string;
  infoLight: string;
}

// Chart Colors Interface
interface ChartColors {
  primary: string;
  secondary: string;
  tertiary: string;
  positive: string;
  negative: string;
  neutral: string;
  gradient1: string;
  gradient2: string;
}

// Border Colors Interface
interface BorderColors {
  primary: string;
  secondary: string;
  focus: string;
  error: string;
  success: string;
}

// Shadow Colors Interface
interface ShadowColors {
  light: string;
  medium: string;
  dark: string;
}

// Font Family Theme Interface
interface FontFamilyTheme {
  regular: string;
  medium: string;
  bold: string;
  monospace: string;
}

// Font Size Theme Interface
interface FontSizeTheme {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  display1: number;
  display2: number;
}

// Font Weight Theme Interface
interface FontWeightTheme {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
}

// Color Theme Interface
export interface ColorTheme {
  brand: BrandColors;
  text: TextColors;
  background: BackgroundColors;
  status: StatusColors;
  chart: ChartColors;
  border: BorderColors;
  shadow: ShadowColors;
}

// Typography Theme Interface
export interface TypographyTheme {
  fontFamily: FontFamilyTheme;
  fontSize: FontSizeTheme;
  fontWeight: FontWeightTheme;
  lineHeight: Record<keyof FontSizeTheme, number>;
}

// Spacing Theme Interface
export interface SpacingTheme {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

// Breakpoints Theme Interface
export interface BreakpointsTheme {
  mobileS: number;
  mobileL: number;
  tablet: number;
  desktop: number;
}

// Main Theme Interface extending DefaultTheme
export interface Theme extends DefaultTheme {
  colors: ColorTheme;
  typography: TypographyTheme;
  spacing: SpacingTheme;
  breakpoints: BreakpointsTheme;
}