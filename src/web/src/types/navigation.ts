import { NavigationProp, RouteProp } from '@react-navigation/native'; // ^6.0.0
import { StackNavigationProp } from '@react-navigation/stack'; // ^6.0.0
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'; // ^6.0.0

// Root stack navigation parameters
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

// Authentication flow navigation parameters
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MFA: {
    token: string;
  };
};

// Main tab navigation parameters
export type MainTabParamList = {
  Dashboard: undefined;
  Accounts: undefined;
  Budgets: undefined;
  Investments: undefined;
  Profile: undefined;
};

// Account stack navigation parameters
export type AccountStackParamList = {
  AccountsList: undefined;
  AccountDetail: {
    accountId: string;
  };
  AddAccount: undefined;
};

// Budget stack navigation parameters
export type BudgetStackParamList = {
  BudgetsList: undefined;
  BudgetDetail: {
    budgetId: string;
  };
  CreateBudget: undefined;
};

// Investment stack navigation parameters
export type InvestmentStackParamList = {
  InvestmentsList: undefined;
  InvestmentDetail: {
    investmentId: string;
  };
  Portfolio: undefined;
};

// Profile stack navigation parameters
export type ProfileStackParamList = {
  ProfileMain: undefined;
  Settings: undefined;
  Security: undefined;
};

// Navigation prop types for each stack
export type RootStackNavigationProp = StackNavigationProp<RootStackParamList>;
export type AuthStackNavigationProp = StackNavigationProp<AuthStackParamList>;
export type MainTabNavigationProp = BottomTabNavigationProp<MainTabParamList>;
export type AccountStackNavigationProp = StackNavigationProp<AccountStackParamList>;
export type BudgetStackNavigationProp = StackNavigationProp<BudgetStackParamList>;
export type InvestmentStackNavigationProp = StackNavigationProp<InvestmentStackParamList>;
export type ProfileStackNavigationProp = StackNavigationProp<ProfileStackParamList>;

// Route prop types for each stack
export type RootStackRouteProp<T extends keyof RootStackParamList> = RouteProp<RootStackParamList, T>;
export type AuthStackRouteProp<T extends keyof AuthStackParamList> = RouteProp<AuthStackParamList, T>;
export type MainTabRouteProp<T extends keyof MainTabParamList> = RouteProp<MainTabParamList, T>;
export type AccountStackRouteProp<T extends keyof AccountStackParamList> = RouteProp<AccountStackParamList, T>;
export type BudgetStackRouteProp<T extends keyof BudgetStackParamList> = RouteProp<BudgetStackParamList, T>;
export type InvestmentStackRouteProp<T extends keyof InvestmentStackParamList> = RouteProp<InvestmentStackParamList, T>;
export type ProfileStackRouteProp<T extends keyof ProfileStackParamList> = RouteProp<ProfileStackParamList, T>;