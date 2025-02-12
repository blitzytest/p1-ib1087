import { jest } from '@jest/globals';
import '@testing-library/jest-native/extend-expect';
import { cleanup } from '@testing-library/react-native';
import fetchMock from 'jest-fetch-mock';
import * as performance from 'jest-performance';

// Import internal mocks
import { mockApi } from './mocks/api';
import { mockUseNavigation } from './mocks/navigation';
import { resetMockStorage } from './mocks/storage';

/**
 * Configure Jest environment and global settings
 */
function setupJestConfig(): void {
  // Set Jest timeout for async operations
  jest.setTimeout(10000);

  // Enable fetch mocking
  fetchMock.enableMocks();

  // Configure console mocks with detailed logging
  const originalError = console.error;
  const originalWarn = console.warn;
  
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('deprecated')) {
      return;
    }
    originalWarn.call(console, ...args);
  };

  // Configure coverage thresholds
  jest.collectCoverageFrom([
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/types/**',
    '!src/test/**'
  ]);

  // Configure snapshot serializers
  expect.addSnapshotSerializer({
    test: (val) => val && val.$$typeof === Symbol.for('react.test.json'),
    print: (val, serialize) => serialize(val),
  });

  // Initialize performance monitoring
  performance.install({
    collectMemory: true,
    collectCPU: true,
    reportInterval: 1000,
  });
}

/**
 * Setup global mocks for testing environment
 */
function setupGlobalMocks(): void {
  // Mock React Native specific modules
  jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
  jest.mock('react-native-gesture-handler', () => ({
    PanGestureHandler: 'PanGestureHandler',
    State: {},
  }));

  // Mock secure storage
  jest.mock('@react-native-community/async-storage', () => ({
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    getAllKeys: jest.fn(),
  }));

  // Mock navigation
  jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => mockUseNavigation(),
  }));

  // Mock Plaid SDK
  jest.mock('react-native-plaid-link-sdk', () => ({
    PlaidLink: 'PlaidLink',
    usePlaidLink: jest.fn(),
  }));

  // Mock chart library
  jest.mock('react-native-chart-kit', () => ({
    LineChart: 'LineChart',
    BarChart: 'BarChart',
    PieChart: 'PieChart',
  }));

  // Mock biometrics
  jest.mock('react-native-biometrics', () => ({
    BiometryTypes: {
      TouchID: 'TouchID',
      FaceID: 'FaceID',
      Biometrics: 'Biometrics',
    },
    simplePrompt: jest.fn(),
  }));

  // Mock encryption utilities
  jest.mock('crypto-js', () => ({
    AES: {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    },
    enc: {
      Utf8: {},
      Base64: {},
    },
  }));
}

/**
 * Reset test environment before each test
 */
function resetTestEnvironment(): void {
  // Clear all mocks
  jest.clearAllMocks();
  fetchMock.resetMocks();
  resetMockStorage();
  mockApi.clearMocks();

  // Reset performance metrics
  performance.reset();
}

/**
 * Validate test metrics after each test
 */
function validateTestMetrics(): void {
  const metrics = performance.getMetrics();
  
  // Log performance warnings if thresholds exceeded
  if (metrics.meanCPU > 80) {
    console.warn(`High CPU usage detected: ${metrics.meanCPU}%`);
  }
  if (metrics.maxMemory > 512) {
    console.warn(`High memory usage detected: ${metrics.maxMemory}MB`);
  }
}

// Configure global test lifecycle hooks
beforeAll(() => {
  setupJestConfig();
  setupGlobalMocks();
});

afterAll(() => {
  cleanup();
  performance.uninstall();
});

beforeEach(() => {
  resetTestEnvironment();
});

afterEach(() => {
  cleanup();
  validateTestMetrics();
});

// Export setup functions for manual configuration
export {
  setupJestConfig,
  setupGlobalMocks,
  resetTestEnvironment,
  validateTestMetrics,
};