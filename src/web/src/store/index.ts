/**
 * Root Redux store configuration for the Mint Clone application
 * Implements centralized state management with persistence and performance optimization
 * @version 1.0.0
 */

import { configureStore, combineReducers, Middleware } from '@reduxjs/toolkit'; // ^1.9.0
import { 
  persistStore, 
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER
} from 'redux-persist'; // ^6.0.0
import AsyncStorage from '@react-native-async-storage/async-storage'; // ^1.18.1
import { createStateSyncMiddleware } from 'redux-state-sync'; // ^3.1.0
import { encryptTransform } from 'redux-persist-transform-encrypt'; // ^3.0.1

// Import reducers
import authReducer from './slices/authSlice';
import accountsReducer from './slices/accountsSlice';

// Import middleware
import { apiMiddleware } from './middleware/api';

// Import security utilities
import { generateSecureKey } from '../utils/security';

// Configure persistence with encryption
const encryptionKey = generateSecureKey();
const encryptConfig = {
  secretKey: encryptionKey,
  onError: (error: Error) => {
    console.error('Encryption Error:', error);
  }
};

// Persistence configuration
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'accounts'], // Only persist these reducers
  transforms: [encryptTransform(encryptConfig)],
  version: 1,
  timeout: 10000, // 10 seconds
  debug: process.env.NODE_ENV === 'development',
  migrate: (state: any) => {
    // Handle state migrations here
    return Promise.resolve(state);
  },
  stateReconciler: (inboundState: any, originalState: any) => {
    // Custom state reconciliation logic
    return { ...originalState, ...inboundState };
  }
};

// Combine reducers with proper typing
const rootReducer = combineReducers({
  auth: authReducer,
  accounts: accountsReducer
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure state sync middleware
const stateSyncConfig = {
  blacklist: ['persist/PERSIST', 'persist/REHYDRATE'],
  broadcastChannelOption: {
    type: 'localstorage'
  }
};

// Configure middleware stack
const middlewareStack: Middleware[] = [
  apiMiddleware,
  createStateSyncMiddleware(stateSyncConfig)
];

// Configure Redux DevTools
const devToolsConfig = {
  name: 'Mint Clone',
  trace: true,
  traceLimit: 25
};

// Create store with configuration
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]
      },
      thunk: true,
      immutableCheck: true
    }).concat(middlewareStack),
  devTools: process.env.NODE_ENV === 'development' ? devToolsConfig : false,
  preloadedState: undefined,
  enhancers: []
});

// Create persistor
export const persistor = persistStore(store, null, () => {
  console.log('Rehydration completed');
});

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Type guard for checking if state is rehydrated
export const isStateRehydrated = (state: RootState): boolean => {
  return state._persist?.rehydrated === true;
};

// Utility function to reset store
export const resetStore = async () => {
  await persistor.purge();
  store.dispatch({ type: 'RESET_STORE' });
};

// Export store instance
export default store;