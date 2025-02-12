import { useCallback, useEffect } from 'react'; // ^18.0.0
import { useSelector, useDispatch } from 'react-redux'; // ^8.0.0
import { useWindowDimensions } from 'react-native'; // 0.71+
import { Theme } from '../types/theme';
import theme from '../config/theme';
import { uiActions } from '../store/slices/uiSlice';

// Performance tracking constants
const PERFORMANCE_THRESHOLD = 16; // 60fps frame budget
const DEBOUNCE_DELAY = 150;

/**
 * Custom hook for theme management and responsive breakpoint handling
 * Provides theme state, switching functionality, and breakpoint utilities
 */
export const useTheme = () => {
  const dispatch = useDispatch();
  const { width, height } = useWindowDimensions();
  
  // Select theme state from Redux store
  const currentTheme = useSelector((state: { ui: { theme: Theme } }) => state.ui.theme);
  const currentBreakpoint = useSelector((state: { ui: { currentBreakpoint: string } }) => 
    state.ui.currentBreakpoint
  );

  /**
   * Calculates current breakpoint based on window dimensions
   * Implements performance tracking for optimization
   */
  const calculateBreakpoint = useCallback((windowWidth: number): string => {
    const startTime = performance.now();

    const { breakpoints } = theme;
    let newBreakpoint = 'mobileS';

    if (windowWidth >= breakpoints.desktop) {
      newBreakpoint = 'desktop';
    } else if (windowWidth >= breakpoints.tablet) {
      newBreakpoint = 'tablet';
    } else if (windowWidth >= breakpoints.mobileL) {
      newBreakpoint = 'mobileL';
    }

    // Performance monitoring
    const duration = performance.now() - startTime;
    if (duration > PERFORMANCE_THRESHOLD) {
      console.warn('Breakpoint calculation exceeded performance budget', { duration });
    }

    return newBreakpoint;
  }, []);

  /**
   * Memoized theme switching function with validation
   */
  const setTheme = useCallback((newTheme: Theme) => {
    try {
      // Validate theme structure
      const { colors, typography, spacing, breakpoints } = newTheme;
      if (!colors || !typography || !spacing || !breakpoints) {
        throw new Error('Invalid theme structure');
      }

      dispatch(uiActions.setTheme(newTheme));
    } catch (error) {
      console.error('Theme switch failed:', error);
      // Fallback to default theme
      dispatch(uiActions.setTheme(theme));
    }
  }, [dispatch]);

  /**
   * Breakpoint comparison utility
   */
  const compareBreakpoint = useCallback((comparison: string): boolean => {
    const breakpointOrder = ['mobileS', 'mobileL', 'tablet', 'desktop'];
    const currentIndex = breakpointOrder.indexOf(currentBreakpoint);
    const compareIndex = breakpointOrder.indexOf(comparison);
    
    if (currentIndex === -1 || compareIndex === -1) {
      console.warn('Invalid breakpoint comparison');
      return false;
    }
    
    return currentIndex >= compareIndex;
  }, [currentBreakpoint]);

  /**
   * Breakpoint check utility
   */
  const isBreakpoint = useCallback((breakpoint: string): boolean => 
    currentBreakpoint === breakpoint, [currentBreakpoint]);

  /**
   * Theme transition utility for smooth theme changes
   */
  const themeTransition = useCallback((duration = 300) => ({
    transition: `all ${duration}ms ease-in-out`
  }), []);

  // Handle window resize with debouncing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const newBreakpoint = calculateBreakpoint(width);
        if (newBreakpoint !== currentBreakpoint) {
          dispatch(uiActions.setBreakpoint(newBreakpoint));
        }
      }, DEBOUNCE_DELAY);
    };

    handleResize();

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
    };
  }, [width, height, calculateBreakpoint, currentBreakpoint, dispatch]);

  // Initialize system theme preference listener
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleThemeChange = (e: MediaQueryListEvent) => {
      // Theme switching logic can be implemented here
      console.log('System theme preference changed:', e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, []);

  return {
    theme: currentTheme,
    setTheme,
    currentBreakpoint,
    isBreakpoint,
    compareBreakpoint,
    themeTransition,
  };
};