import React, { useCallback, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useNavigationPersistence } from '@react-navigation/native';
import { ErrorBoundary } from 'react-error-boundary';
import { useNavigationAnalytics } from '@react-navigation/analytics';

import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { RootStackParamList } from '../types/navigation';

// Create root stack navigator
const Stack = createStackNavigator<RootStackParamList>();

// Navigation persistence key
const PERSISTENCE_KEY = 'navigation-state-v1';

// Deep linking configuration
const DEEP_LINKING_CONFIG = {
  screens: {
    Auth: {
      screens: {
        Login: 'login',
        Register: 'register'
      }
    },
    Main: {
      screens: {
        Dashboard: 'dashboard',
        Accounts: 'accounts',
        Budgets: 'budgets',
        Investments: 'investments'
      }
    }
  }
};

/**
 * Error boundary fallback component for navigation errors
 */
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
        color: theme.colors.status.error,
        marginBottom: theme.spacing.md
      }}>
        Navigation Error: {error.message}
      </Text>
      <Button
        label="Retry"
        onPress={resetErrorBoundary}
        variant="primary"
        testID="navigation-error-retry"
      />
    </View>
  );
};

/**
 * Root navigation component that manages authentication state and navigation
 */
const AppNavigator: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const navigationRef = useRef();
  const routeNameRef = useRef<string>();

  // Setup navigation analytics
  const { trackScreenView } = useNavigationAnalytics();

  // Configure navigation persistence
  const { 
    initialNavigationState,
    onNavigationStateChange,
    loadNavigationState,
    saveNavigationState,
  } = useNavigationPersistence({
    persistenceKey: PERSISTENCE_KEY,
    persistNavigationState: async (navState) => {
      // Encrypt navigation state before storing
      await saveNavigationState(navState);
    },
    loadNavigationState: async () => {
      // Decrypt and validate navigation state
      const state = await loadNavigationState();
      return state;
    }
  });

  // Handle navigation state changes for analytics
  const handleNavigationStateChange = useCallback((state) => {
    const previousRouteName = routeNameRef.current;
    const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;

    if (currentRouteName && previousRouteName !== currentRouteName) {
      // Track screen view
      trackScreenView({
        screenName: currentRouteName,
        timestamp: new Date().toISOString()
      });

      // Update route name ref
      routeNameRef.current = currentRouteName;
    }

    // Persist navigation state
    onNavigationStateChange(state);
  }, [onNavigationStateChange, trackScreenView]);

  // Initialize route tracking
  useEffect(() => {
    const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;
    if (currentRouteName) {
      routeNameRef.current = currentRouteName;
    }
  }, []);

  return (
    <ErrorBoundary
      FallbackComponent={NavigationErrorFallback}
      onReset={() => {
        // Reset navigation state on error
        navigationRef.current?.resetRoot({
          index: 0,
          routes: [{ name: isAuthenticated ? 'Main' : 'Auth' }]
        });
      }}
    >
      <NavigationContainer
        ref={navigationRef}
        initialState={initialNavigationState}
        onStateChange={handleNavigationStateChange}
        theme={theme}
        linking={{
          prefixes: ['mintclone://'],
          config: DEEP_LINKING_CONFIG,
          // Validate deep links for security
          getInitialURL: async () => {
            // Implement deep link validation
            return null;
          }
        }}
      >
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            gestureEnabled: false,
            animationEnabled: true
          }}
        >
          {isAuthenticated ? (
            <Stack.Screen
              name="Main"
              component={MainNavigator}
              options={{ animationEnabled: false }}
            />
          ) : (
            <Stack.Screen
              name="Auth"
              component={AuthNavigator}
              options={{ animationEnabled: false }}
            />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
};

export default AppNavigator;