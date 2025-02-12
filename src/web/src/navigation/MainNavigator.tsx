import React, { useCallback, useEffect, useRef } from 'react';
import { createStackNavigator } from '@react-navigation/stack'; // ^6.0.0
import { TransitionPresets, StackNavigationState } from '@react-navigation/stack'; // ^6.0.0
import { useNavigationContainerRef } from '@react-navigation/native'; // ^6.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import AsyncStorage from '@react-native-async-storage/async-storage';
import analytics from '@react-native-firebase/analytics';

// Internal imports
import { RootStackParamList } from '../types/navigation';
import TabNavigator from './TabNavigator';
import AccountDetailScreen from '../screens/accounts/AccountDetailScreen';
import { useTheme } from '../hooks/useTheme';
import { PERFORMANCE_THRESHOLDS } from '../config/constants';

// Create stack navigator
const Stack = createStackNavigator<RootStackParamList>();

// Constants
const NAVIGATION_PERSISTENCE_KEY = 'navigation-state-v1';
const SCREEN_TRACKING_ENABLED = true;

// Error fallback component
const NavigationErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => {
  const { theme } = useTheme();
  
  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: theme.colors.background.primary 
    }}>
      <Text style={{ 
        color: theme.colors.text.error,
        marginBottom: theme.spacing.md 
      }}>
        Navigation Error: {error.message}
      </Text>
      <Button 
        onPress={resetErrorBoundary}
        title="Retry"
        accessibilityLabel="Retry navigation"
      />
    </View>
  );
};

/**
 * Main navigation stack component that manages the authenticated app flow
 * with error handling and performance monitoring
 */
const MainNavigator: React.FC = () => {
  // Navigation container reference for performance tracking
  const navigationRef = useNavigationContainerRef();
  const routeNameRef = useRef<string>();
  const navigationStartTime = useRef<number>();

  // Theme hook for consistent styling
  const { theme } = useTheme();

  /**
   * Handles navigation state changes for persistence and analytics
   */
  const handleNavigationStateChange = useCallback(
    async (state: StackNavigationState<RootStackParamList>) => {
      try {
        // Persist navigation state
        await AsyncStorage.setItem(NAVIGATION_PERSISTENCE_KEY, JSON.stringify(state));

        if (SCREEN_TRACKING_ENABLED && navigationRef.current) {
          const previousRouteName = routeNameRef.current;
          const currentRouteName = navigationRef.current.getCurrentRoute()?.name;

          if (currentRouteName && previousRouteName !== currentRouteName) {
            // Track screen view in analytics
            await analytics().logScreenView({
              screen_name: currentRouteName,
              screen_class: currentRouteName,
            });

            // Performance monitoring
            const navigationDuration = navigationStartTime.current 
              ? Date.now() - navigationStartTime.current 
              : 0;

            if (navigationDuration > PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME) {
              console.warn('Navigation performance threshold exceeded', {
                duration: navigationDuration,
                fromScreen: previousRouteName,
                toScreen: currentRouteName,
              });
            }

            // Update reference for next change
            routeNameRef.current = currentRouteName;
          }
        }
      } catch (error) {
        console.error('Navigation state handling error:', error);
      }
    },
    [navigationRef]
  );

  // Initialize navigation tracking
  useEffect(() => {
    const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;
    if (currentRouteName) {
      routeNameRef.current = currentRouteName;
    }
  }, [navigationRef]);

  // Screen options with transitions and accessibility
  const screenOptions = {
    headerShown: false,
    presentation: 'card',
    gestureEnabled: true,
    cardOverlayEnabled: true,
    animationEnabled: true,
    ...TransitionPresets.SlideFromRightIOS,
    cardStyle: {
      backgroundColor: theme.colors.background.primary,
    }
  };

  return (
    <ErrorBoundary
      FallbackComponent={NavigationErrorFallback}
      onReset={() => {
        // Reset navigation to initial state on error
        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      }}
    >
      <Stack.Navigator
        screenOptions={screenOptions}
        screenListeners={{
          transitionStart: () => {
            navigationStartTime.current = Date.now();
          },
        }}
      >
        <Stack.Screen
          name="Main"
          component={TabNavigator}
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="AccountDetail"
          component={AccountDetailScreen}
          options={{
            headerShown: true,
            headerTitle: 'Account Details',
            headerBackTitleVisible: false,
            headerTintColor: theme.colors.text.primary,
            headerStyle: {
              backgroundColor: theme.colors.background.primary,
              elevation: 0,
              shadowOpacity: 0,
            },
            headerTitleStyle: {
              ...theme.typography.fontSize.lg,
              color: theme.colors.text.primary,
            },
            headerBackAccessibilityLabel: 'Go back',
          }}
        />
      </Stack.Navigator>
    </ErrorBoundary>
  );
};

export default MainNavigator;