import React, { useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'; // ^6.0.0
import Icon from 'react-native-vector-icons/MaterialIcons'; // ^9.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { useAnalytics } from '@analytics/react'; // ^0.1.0
import { useAccessibility } from '@react-native-community/hooks'; // ^3.0.0

// Internal imports
import { MainTabParamList } from '../types/navigation';
import useTheme from '../hooks/useTheme';

// Screen components (imported dynamically for performance)
const DashboardScreen = React.lazy(() => import('../screens/Dashboard'));
const AccountsScreen = React.lazy(() => import('../screens/Accounts'));
const BudgetsScreen = React.lazy(() => import('../screens/Budgets'));
const InvestmentsScreen = React.lazy(() => import('../screens/Investments'));
const ProfileScreen = React.lazy(() => import('../screens/Profile'));

// Create bottom tab navigator
const Tab = createBottomTabNavigator<MainTabParamList>();

// Error fallback component
const TabErrorFallback = ({ error, resetErrorBoundary }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Something went wrong!</Text>
    <Text>{error.message}</Text>
    <Button onPress={resetErrorBoundary} title="Try again" />
  </View>
);

export const TabNavigator: React.FC = () => {
  // Hooks
  const { theme } = useTheme();
  const analytics = useAnalytics();
  const { isScreenReaderEnabled } = useAccessibility();

  // Screen transition tracking
  const handleTabPress = useCallback((routeName: string) => {
    analytics.track('tab_navigation', {
      screen: routeName,
      timestamp: Date.now()
    });
  }, [analytics]);

  // Tab bar icon configuration
  const getTabBarIcon = useCallback((routeName: string, focused: boolean) => {
    const iconColor = focused ? theme.colors.brand.primary : theme.colors.text.secondary;
    const iconSize = 24;

    const icons = {
      Dashboard: 'dashboard',
      Accounts: 'account-balance',
      Budgets: 'pie-chart',
      Investments: 'trending-up',
      Profile: 'person'
    };

    return (
      <Icon 
        name={icons[routeName]} 
        size={iconSize} 
        color={iconColor}
        accessibilityLabel={`${routeName} tab`}
      />
    );
  }, [theme]);

  // Screen options configuration
  const screenOptions = {
    headerShown: false,
    tabBarActiveTintColor: theme.colors.brand.primary,
    tabBarInactiveTintColor: theme.colors.text.secondary,
    tabBarStyle: {
      backgroundColor: theme.colors.background.primary,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.primary,
      paddingBottom: 5,
      height: 60,
    },
    lazy: true,
    tabBarLabelStyle: {
      fontSize: theme.typography.fontSize.xs,
      fontFamily: theme.typography.fontFamily.regular,
    },
    tabBarAccessibilityLabel: 'Main navigation tabs',
    tabBarAllowFontScaling: isScreenReaderEnabled,
  };

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => getTabBarIcon('Dashboard', focused),
          tabBarLabel: 'Dashboard',
          unmountOnBlur: false,
        }}
        listeners={{
          tabPress: () => handleTabPress('Dashboard')
        }}
      />
      <Tab.Screen
        name="Accounts"
        component={AccountsScreen}
        options={{
          tabBarIcon: ({ focused }) => getTabBarIcon('Accounts', focused),
          tabBarLabel: 'Accounts',
          unmountOnBlur: true,
        }}
        listeners={{
          tabPress: () => handleTabPress('Accounts')
        }}
      />
      <Tab.Screen
        name="Budgets"
        component={BudgetsScreen}
        options={{
          tabBarIcon: ({ focused }) => getTabBarIcon('Budgets', focused),
          tabBarLabel: 'Budgets',
          unmountOnBlur: true,
        }}
        listeners={{
          tabPress: () => handleTabPress('Budgets')
        }}
      />
      <Tab.Screen
        name="Investments"
        component={InvestmentsScreen}
        options={{
          tabBarIcon: ({ focused }) => getTabBarIcon('Investments', focused),
          tabBarLabel: 'Investments',
          unmountOnBlur: true,
        }}
        listeners={{
          tabPress: () => handleTabPress('Investments')
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => getTabBarIcon('Profile', focused),
          tabBarLabel: 'Profile',
          unmountOnBlur: false,
        }}
        listeners={{
          tabPress: () => handleTabPress('Profile')
        }}
      />
    </Tab.Navigator>
  );
};

export default TabNavigator;