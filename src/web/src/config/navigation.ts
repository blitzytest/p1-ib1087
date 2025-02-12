import { StackNavigationOptions } from '@react-navigation/stack'; // ^6.0.0
import { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs'; // ^6.0.0
import { RootStackParamList } from '../types/navigation';

// Default screen options for stack navigators
const DEFAULT_SCREEN_OPTIONS: StackNavigationOptions = {
  headerStyle: {
    backgroundColor: '#FFFFFF',
    elevation: 0,
    shadowOpacity: 0,
  },
  headerTitleStyle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardStyle: {
    backgroundColor: '#FFFFFF',
  },
  gestureEnabled: true,
  animationEnabled: true,
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 250,
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: 200,
      },
    },
  },
  gestureResponseDistance: 50,
  gestureVelocityImpact: 0.9,
};

// Default options for bottom tab navigator
const DEFAULT_TAB_OPTIONS: BottomTabNavigationOptions = {
  tabBarStyle: {
    height: 60,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  tabBarActiveTintColor: '#007AFF',
  tabBarInactiveTintColor: '#8E8E93',
  tabBarLabelStyle: {
    fontSize: 12,
    fontWeight: '500',
  },
  tabBarIconStyle: {
    marginTop: 4,
  },
};

// Factory function for generating screen options with overrides
export const getScreenOptions = (options: Partial<StackNavigationOptions> = {}): StackNavigationOptions => ({
  ...DEFAULT_SCREEN_OPTIONS,
  ...options,
});

// Factory function for generating tab options with overrides
export const getTabOptions = (options: Partial<BottomTabNavigationOptions> = {}): BottomTabNavigationOptions => ({
  ...DEFAULT_TAB_OPTIONS,
  ...options,
});

// Root stack navigator configuration
export const rootStackConfig = {
  screenOptions: getScreenOptions({
    headerShown: false,
  }),
  initialRouteName: 'Auth' as keyof RootStackParamList,
};

// Authentication stack configuration
export const authStackConfig = {
  screenOptions: getScreenOptions({
    headerBackTitleVisible: false,
    headerTintColor: '#007AFF',
  }),
  initialRouteName: 'Login',
};

// Main tab navigator configuration
export const mainTabConfig = {
  screenOptions: getTabOptions({
    headerShown: false,
  }),
  initialRouteName: 'Dashboard',
};

// Account stack configuration
export const accountStackConfig = {
  screenOptions: getScreenOptions({
    headerBackTitleVisible: false,
    headerTintColor: '#007AFF',
  }),
  initialRouteName: 'AccountsList',
};

// Budget stack configuration
export const budgetStackConfig = {
  screenOptions: getScreenOptions({
    headerBackTitleVisible: false,
    headerTintColor: '#007AFF',
  }),
  initialRouteName: 'BudgetsList',
};

// Investment stack configuration
export const investmentStackConfig = {
  screenOptions: getScreenOptions({
    headerBackTitleVisible: false,
    headerTintColor: '#007AFF',
  }),
  initialRouteName: 'InvestmentsList',
};

// Profile stack configuration
export const profileStackConfig = {
  screenOptions: getScreenOptions({
    headerBackTitleVisible: false,
    headerTintColor: '#007AFF',
  }),
  initialRouteName: 'ProfileMain',
};