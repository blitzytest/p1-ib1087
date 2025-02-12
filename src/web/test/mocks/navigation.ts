import { NavigationProp } from '@react-navigation/native'; // ^6.0.0
import { RootStackParamList } from '../../src/types/navigation';
import jest from 'jest'; // ^29.0.0

// Mock navigation state type
type MockNavigationState = {
  routes: Array<{
    name: keyof RootStackParamList;
    params?: object;
  }>;
  index: number;
};

// Global mock functions with parameter validation
export const mockNavigate = jest.fn((name: keyof RootStackParamList, params?: object) => {
  return Promise.resolve();
});

export const mockGoBack = jest.fn(() => {
  return Promise.resolve();
});

export const mockDispatch = jest.fn((action: object) => {
  return Promise.resolve();
});

/**
 * Creates a fully typed mock navigation object with state management
 * @param options Configuration options for the mock navigation
 * @returns Mock navigation object with complete navigation functionality
 */
export function createNavigationMock(options: {
  initialRoute?: keyof RootStackParamList;
  params?: object;
  navigationState?: MockNavigationState;
} = {}) {
  const navigationState: MockNavigationState = options.navigationState || {
    routes: [
      {
        name: options.initialRoute || 'Auth',
        params: options.params,
      },
    ],
    index: 0,
  };

  const listeners = new Set<(state: MockNavigationState) => void>();

  const navigation: NavigationProp<RootStackParamList> = {
    navigate: jest.fn((name: keyof RootStackParamList, params?: object) => {
      navigationState.routes.push({ name, params });
      navigationState.index++;
      listeners.forEach(listener => listener(navigationState));
      return mockNavigate(name, params);
    }),

    goBack: jest.fn(() => {
      if (navigationState.index > 0) {
        navigationState.routes.pop();
        navigationState.index--;
        listeners.forEach(listener => listener(navigationState));
      }
      return mockGoBack();
    }),

    reset: jest.fn((state: any) => {
      Object.assign(navigationState, state);
      listeners.forEach(listener => listener(navigationState));
    }),

    setParams: jest.fn((params: object) => {
      if (navigationState.routes[navigationState.index]) {
        navigationState.routes[navigationState.index].params = {
          ...navigationState.routes[navigationState.index].params,
          ...params,
        };
        listeners.forEach(listener => listener(navigationState));
      }
    }),

    dispatch: jest.fn((action: object) => {
      return mockDispatch(action);
    }),

    addListener: jest.fn((event: string, callback: any) => {
      if (event === 'state') {
        listeners.add(callback);
      }
      return () => {
        listeners.delete(callback);
      };
    }),

    removeListener: jest.fn((event: string, callback: any) => {
      if (event === 'state') {
        listeners.delete(callback);
      }
    }),

    // Required navigation prop fields
    getId: jest.fn(() => '1'),
    getParent: jest.fn(() => null),
    getState: jest.fn(() => navigationState),
    isFocused: jest.fn(() => true),
  };

  return navigation;
}

/**
 * Mock implementation of useNavigation hook for testing
 * @returns Type-safe mock navigation object
 */
export function mockUseNavigation(): NavigationProp<RootStackParamList> {
  return createNavigationMock({
    initialRoute: 'Auth',
  });
}

// Pre-configured mock navigation for common testing scenarios
export const mockNavigation = createNavigationMock();