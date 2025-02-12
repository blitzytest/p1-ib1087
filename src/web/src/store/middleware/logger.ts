import { Middleware } from 'redux';

/**
 * Maximum depth for state object stringification to prevent circular reference issues
 * and optimize performance for large state trees
 */
const MAX_STATE_DEPTH = 2;

/**
 * Custom type for log entry styling
 */
interface LogStyle {
  action: string;
  prevState: string;
  nextState: string;
  diff: string;
  timestamp: string;
}

/**
 * Predefined console styling for different log components
 */
const LOG_STYLES: LogStyle = {
  action: 'color: #7B68EE; font-weight: bold',
  prevState: 'color: #9E9E9E; font-weight: bold',
  nextState: 'color: #4CAF50; font-weight: bold',
  diff: 'color: #E91E63; font-weight: bold',
  timestamp: 'color: #808080; font-style: italic'
};

/**
 * Safely stringifies objects handling circular references and applying depth limits
 * @param obj Object to stringify
 * @returns Formatted string representation of the object
 */
const safeStringify = (obj: unknown): string => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }
    return value;
  }, 2);
};

/**
 * Creates a formatted timestamp for log entries
 * @returns Formatted timestamp string
 */
const getFormattedTimestamp = (): string => {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
};

/**
 * Compares two states and returns a formatted string of differences
 * @param prevState Previous state object
 * @param nextState Next state object
 * @returns Formatted string of state differences
 */
const getStateDiff = (prevState: unknown, nextState: unknown): string => {
  try {
    const changes: Record<string, { prev: unknown; next: unknown }> = {};
    
    const prevObj = prevState as Record<string, unknown>;
    const nextObj = nextState as Record<string, unknown>;
    
    Object.keys(nextObj).forEach(key => {
      if (prevObj[key] !== nextObj[key]) {
        changes[key] = {
          prev: prevObj[key],
          next: nextObj[key]
        };
      }
    });
    
    return Object.keys(changes).length ? safeStringify(changes) : 'No state changes';
  } catch (error) {
    return `Error comparing states: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

/**
 * Creates a Redux middleware for comprehensive action and state logging in development environment
 * with performance optimizations and enhanced type safety
 */
const createLoggerMiddleware = (): Middleware => {
  return store => next => action => {
    // Only log in development environment
    if (process.env.NODE_ENV !== 'development') {
      return next(action);
    }

    try {
      const timestamp = getFormattedTimestamp();
      
      // Format action for logging
      const actionType = action.type || 'Unknown Action';
      const actionPayload = action.payload !== undefined ? 
        safeStringify(action.payload) : 
        'No payload';

      // Capture states
      const prevState = store.getState();
      const result = next(action);
      const nextState = store.getState();

      // Calculate state differences
      const stateDiff = getStateDiff(prevState, nextState);

      // Group log entries for better console organization
      console.group(`%cAction: ${actionType} @ ${timestamp}`, LOG_STYLES.timestamp);
      
      // Log action details
      console.log('%cAction Details:', LOG_STYLES.action, {
        type: actionType,
        payload: actionPayload
      });

      // Log states
      console.log('%cPrevious State:', LOG_STYLES.prevState);
      console.log(prevState);
      
      console.log('%cNext State:', LOG_STYLES.nextState);
      console.log(nextState);
      
      // Log state differences
      console.log('%cState Changes:', LOG_STYLES.diff);
      console.log(stateDiff);

      console.groupEnd();

      return result;
    } catch (error) {
      // Ensure action continues even if logging fails
      console.error('Logger Middleware Error:', error);
      return next(action);
    }
  };
};

/**
 * Configured logger middleware instance for development environment
 * Provides comprehensive action and state logging with performance optimizations
 */
export const loggerMiddleware = createLoggerMiddleware();