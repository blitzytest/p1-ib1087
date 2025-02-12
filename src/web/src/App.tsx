import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ThemeProvider } from '@react-navigation/native';
import { ErrorBoundary } from 'react-error-boundary';
import { View, Text, StyleSheet, Platform, AccessibilityInfo } from 'react-native';

import AppNavigator from './navigation/AppNavigator';
import { store, persistor } from './store';
import { theme } from './config/theme';

/**
 * Error fallback component for global error handling
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <View style={styles.errorContainer}>
    <Text style={styles.errorTitle}>Something went wrong</Text>
    <Text style={styles.errorMessage}>{error.message}</Text>
    <Text 
      style={styles.errorButton}
      onPress={resetErrorBoundary}
      accessibilityRole="button"
      accessibilityLabel="Retry application"
    >
      Try Again
    </Text>
  </View>
);

/**
 * Root application component that sets up core providers and error handling
 */
const App: React.FC = () => {
  // Initialize accessibility settings
  useEffect(() => {
    if (Platform.OS !== 'web') {
      AccessibilityInfo.announceForAccessibility('Mint Clone application loaded');
    }

    // Configure accessibility timeout
    AccessibilityInfo.setAccessibilityFocus(0);
  }, []);

  // Handle global errors
  const handleError = (error: Error) => {
    console.error('Global error:', error);
    // Additional error reporting would be implemented here
  };

  // Handle persistence loading state
  const handlePersistorLoading = () => (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => {
        // Clear any error state and retry app initialization
        persistor.purge();
      }}
    >
      <Provider store={store}>
        <PersistGate 
          loading={handlePersistorLoading()} 
          persistor={persistor}
        >
          <ThemeProvider value={theme}>
            <AppNavigator />
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.background.primary
  },
  errorTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md
  },
  errorMessage: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg
  },
  errorButton: {
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.brand.primary,
    padding: theme.spacing.sm
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary
  },
  loadingText: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.text.primary
  }
});

export default App;