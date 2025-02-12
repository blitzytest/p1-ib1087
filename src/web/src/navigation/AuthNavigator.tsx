import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { TransitionPresets } from '@react-navigation/stack';
import { Platform } from 'react-native';
import Analytics from '@segment/analytics-react-native';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import MFAScreen from '../screens/auth/MFAScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import { AuthStackParamList } from '../types/navigation';
import { useTheme } from '../hooks/useTheme';

// Create stack navigator with type safety
const Stack = createStackNavigator<AuthStackParamList>();

/**
 * Authentication stack navigator component that manages the flow between
 * authentication-related screens with proper transitions and analytics
 */
const AuthNavigator: React.FC = () => {
  const { theme } = useTheme();

  // Default screen options with platform-specific transitions
  const screenOptions = {
    ...Platform.select({
      ios: TransitionPresets.SlideFromRightIOS,
      android: TransitionPresets.RevealFromBottomAndroid,
      default: TransitionPresets.DefaultTransition,
    }),
    headerShown: false,
    cardStyle: {
      backgroundColor: theme.colors.background.primary
    },
    gestureEnabled: true,
    gestureDirection: 'horizontal',
    animationEnabled: true,
    presentation: 'card' as const,
  };

  // Track screen views for analytics
  const handleScreenChange = (screenName: string) => {
    Analytics.screen(screenName, {
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={screenOptions}
      screenListeners={{
        focus: (e) => handleScreenChange(e.target?.split('-')[0] || ''),
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          animationTypeForReplace: 'pop',
          gestureEnabled: false,
        }}
      />

      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          gestureEnabled: Platform.OS !== 'web',
          animationEnabled: true,
        }}
      />

      <Stack.Screen
        name="MFA"
        component={MFAScreen}
        options={{
          gestureEnabled: false,
          animationEnabled: true,
        }}
      />

      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          gestureEnabled: Platform.OS !== 'web',
          animationEnabled: true,
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;