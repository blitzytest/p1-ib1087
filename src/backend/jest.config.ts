// jest.config.ts
// @jest v29.5.0
// @ts-jest v29.1.0

import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // Set Node.js as test environment
  testEnvironment: 'node',

  // Configure TypeScript support
  preset: 'ts-jest',

  // Define test file locations
  roots: [
    '<rootDir>/src',
    '<rootDir>/test'
  ],

  // Configure code coverage collection
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'clover',
    'json'
  ],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],

  // Module path aliases for clean imports
  moduleNameMapper: {
    '@shared/(.*)': '<rootDir>/shared/$1',
    '@types/(.*)': '<rootDir>/types/$1',
    '@utils/(.*)': '<rootDir>/utils/$1',
    '@middleware/(.*)': '<rootDir>/middleware/$1',
    '@models/(.*)': '<rootDir>/models/$1',
    '@services/(.*)': '<rootDir>/services/$1',
    '@controllers/(.*)': '<rootDir>/controllers/$1',
    '@config/(.*)': '<rootDir>/config/$1',
    '@errors/(.*)': '<rootDir>/errors/$1',
    '@constants/(.*)': '<rootDir>/constants/$1'
  },

  // Test setup and configuration
  setupFilesAfterEnv: [
    '<rootDir>/test/setup.ts'
  ],
  testTimeout: 10000,
  clearMocks: true,
  verbose: true,

  // Test reporters for output formatting
  reporters: [
    'default',
    'jest-junit'
  ],

  // Additional configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      diagnostics: true
    }
  },

  // Module file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json'
  ],

  // Error handling and formatting
  errorOnDeprecated: true,
  bail: 1,
  maxWorkers: '50%'
};

export default config;