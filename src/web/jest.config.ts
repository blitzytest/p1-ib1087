import type { Config } from '@jest/types';
import { setupJestConfig } from './test/setup';

/**
 * Comprehensive Jest configuration for enterprise-grade React Native testing
 * Includes coverage thresholds, module mappings, and platform-specific settings
 * @version 1.0.0
 */
const jestConfig: Config.InitialOptions = {
  // Use React Native preset for mobile testing
  preset: 'react-native',

  // Test environment configuration
  testEnvironment: 'node',
  setupFiles: ['./test/setup.ts'],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],

  // Global variables
  globals: {
    __DEV__: true
  },

  // Module resolution configuration
  moduleNameMapper: {
    // Path aliases
    '^@/(.*)$': '<rootDir>/src/$1',
    
    // Asset mocks
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/test/__mocks__/fileMock.js',
    '\\.(css|less|scss|sass)$': '<rootDir>/test/__mocks__/styleMock.js'
  },

  // File extensions to process
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/types/**',
    '!src/test/**',
    '!src/**/__mocks__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: '<rootDir>/coverage',

  // Test path configuration
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    '/coverage/',
    '/dist/'
  ],

  // Transform ignore patterns for node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-.*)/)'
  ],

  // Performance and execution configuration
  maxWorkers: '50%',
  testTimeout: 10000,
  verbose: true,

  // Mock and cleanup configuration
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,

  // Watch configuration
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './reports/junit',
        outputName: 'jest-junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ],

  // Snapshot configuration
  snapshotFormat: {
    printBasicPrototype: false,
    escapeString: true
  },

  // Error handling configuration
  bail: 0,
  detectOpenHandles: true,
  forceExit: true
};

export default jestConfig;