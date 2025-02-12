/**
 * Entry point for the Mint Clone React Native mobile application
 * Handles app registration, initialization, error boundaries, and performance monitoring
 * @version 1.0.0
 */

import { AppRegistry } from 'react-native'; // ^0.71+
import { initializeErrorTracking } from '@sentry/react-native'; // ^5.0+
import { initializePerformanceMonitoring } from '@datadog/mobile-react-native'; // ^1.0+
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import App from './src/App';

// App name constant
const appName = 'MintClone';

// Track app startup time for performance monitoring
const startupTime = Date.now();

/**
 * Initializes error tracking and performance monitoring services
 */
const initializeMonitoring = async () => {
  try {
    // Initialize Sentry for error tracking
    initializeErrorTracking({
      dsn: process.env.REACT_APP_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 1.0,
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,
      attachStacktrace: true,
      debug: process.env.NODE_ENV === 'development'
    });

    // Initialize Datadog for performance monitoring
    initializePerformanceMonitoring({
      clientToken: process.env.REACT_APP_DATADOG_CLIENT_TOKEN,
      applicationId: process.env.REACT_APP_DATADOG_APPLICATION_ID,
      env: process.env.NODE_ENV,
      trackInteractions: true,
      trackResources: true,
      trackLongTasks: true,
      sampleRate: 100
    });

    // Set performance thresholds
    if (process.env.NODE_ENV === 'development') {
      console.log('Monitoring services initialized');
    }
  } catch (error) {
    console.error('Failed to initialize monitoring:', error);
  }
};

/**
 * Registers the React Native application with the native platform
 */
const registerApp = () => {
  // Wrap App component with error boundary
  const AppWithErrorBoundary = () => (
    <ErrorBoundary
      fallback={({ error, resetErrorBoundary }) => (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Something went wrong!</Text>
          <Text>{error.message}</Text>
          <Button onPress={resetErrorBoundary} title="Try again" />
        </View>
      )}
      onError={(error, info) => {
        // Log error to monitoring service
        console.error('App Error:', error);
        initializeErrorTracking.captureException(error, {
          extra: {
            componentStack: info.componentStack,
            startupTime: startupTime
          }
        });
      }}
    >
      <App />
    </ErrorBoundary>
  );

  // Register the app
  AppRegistry.registerComponent(appName, () => AppWithErrorBoundary);

  // Track startup performance
  const startupDuration = Date.now() - startupTime;
  initializePerformanceMonitoring.addTiming('app_startup', startupDuration);

  if (process.env.NODE_ENV === 'development') {
    console.log(`App startup completed in ${startupDuration}ms`);
  }
};

/**
 * Handles application startup tasks and initialization
 */
const handleAppStartup = async () => {
  try {
    // Initialize monitoring services
    await initializeMonitoring();

    // Register the app
    registerApp();

    // Track startup completion
    const totalStartupTime = Date.now() - startupTime;
    if (totalStartupTime > 3000) { // 3 second threshold as per requirements
      console.warn('App startup exceeded performance threshold:', totalStartupTime);
    }
  } catch (error) {
    console.error('App startup failed:', error);
    throw error;
  }
};

// Start the application
handleAppStartup();