/**
 * Analytics utility for comprehensive tracking of user interactions, performance metrics,
 * and error monitoring in the Mint Clone application
 * @version 1.0.0
 */

import Mixpanel from 'mixpanel-react-native'; // v2.3.0
import { User } from '../types/models';

// Analytics event type constants
export const ANALYTICS_EVENTS = {
    SCREEN_VIEW: 'screen_view',
    USER_ACTION: 'user_action',
    ERROR: 'error',
    PERFORMANCE: 'performance',
    AUTH: 'auth',
    ACCOUNT: 'account',
    TRANSACTION: 'transaction',
    BUDGET: 'budget',
    INVESTMENT: 'investment',
    USER_ENGAGEMENT: 'user_engagement',
    FEATURE_USAGE: 'feature_usage',
    SESSION: 'session'
} as const;

// Performance metric type constants
export const PERFORMANCE_METRICS = {
    DASHBOARD_LOAD: 'dashboard_load_time',
    API_LATENCY: 'api_latency',
    RENDER_TIME: 'render_time',
    NETWORK_SPEED: 'network_speed',
    MEMORY_USAGE: 'memory_usage',
    CPU_USAGE: 'cpu_usage',
    BATTERY_IMPACT: 'battery_impact'
} as const;

// Error severity levels
export const ERROR_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
} as const;

// Initialize Mixpanel instance
const mixpanel = new Mixpanel("YOUR_MIXPANEL_TOKEN");

/**
 * Captures device and network context for analytics events
 */
const getSystemContext = () => {
    return {
        timestamp: new Date().toISOString(),
        sessionId: generateSessionId(),
        deviceInfo: {
            platform: getPlatform(),
            osVersion: getOSVersion(),
            appVersion: getAppVersion(),
            deviceModel: getDeviceModel()
        },
        networkInfo: {
            type: getNetworkType(),
            strength: getNetworkStrength(),
            carrier: getNetworkCarrier()
        }
    };
};

/**
 * Tracks screen views with enhanced performance metrics
 * @param screenName - Name of the screen being viewed
 * @param properties - Additional properties to track
 */
export const trackScreenView = (
    screenName: string,
    properties: Record<string, any> = {}
): void => {
    if (!screenName) {
        console.error('Screen name is required for tracking');
        return;
    }

    const startTime = performance.now();
    const context = getSystemContext();

    const eventProperties = {
        ...properties,
        ...context,
        renderStartTime: startTime,
        renderEndTime: performance.now(),
        renderDuration: performance.now() - startTime
    };

    mixpanel.track(ANALYTICS_EVENTS.SCREEN_VIEW, {
        screenName,
        ...eventProperties
    });
};

/**
 * Tracks user interactions with detailed context
 * @param eventName - Name of the user action/event
 * @param properties - Event specific properties
 * @param context - Additional context information
 */
export const trackUserAction = (
    eventName: string,
    properties: Record<string, any> = {},
    context: Record<string, any> = {}
): void => {
    if (!eventName) {
        console.error('Event name is required for tracking');
        return;
    }

    const systemContext = getSystemContext();
    const featureContext = {
        featureName: properties.featureName,
        featureVersion: properties.featureVersion,
        interactionSuccess: properties.success ?? true,
        interactionDuration: properties.duration
    };

    mixpanel.track(ANALYTICS_EVENTS.USER_ACTION, {
        eventName,
        ...properties,
        ...systemContext,
        ...featureContext,
        ...context
    });
};

/**
 * Tracks errors with severity and impact analysis
 * @param error - Error object or message
 * @param context - Error context information
 * @param severity - Error severity level
 */
export const trackError = (
    error: Error | string,
    context: Record<string, any> = {},
    severity: keyof typeof ERROR_SEVERITY = 'MEDIUM'
): void => {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    const systemContext = getSystemContext();
    const errorContext = {
        errorType: error instanceof Error ? error.name : 'Unknown',
        errorMessage,
        errorStack,
        severity,
        timestamp: new Date().toISOString(),
        impact: calculateErrorImpact(severity, context),
        retryAttempt: context.retryAttempt ?? 0
    };

    mixpanel.track(ANALYTICS_EVENTS.ERROR, {
        ...errorContext,
        ...systemContext,
        ...context
    });
};

/**
 * Tracks performance metrics with detailed context
 * @param metricName - Name of the performance metric
 * @param value - Metric value
 * @param metadata - Additional metric metadata
 */
export const trackPerformance = (
    metricName: keyof typeof PERFORMANCE_METRICS,
    value: number,
    metadata: Record<string, any> = {}
): void => {
    if (!Object.keys(PERFORMANCE_METRICS).includes(metricName)) {
        console.error('Invalid performance metric name');
        return;
    }

    const systemContext = getSystemContext();
    const performanceContext = {
        metricName,
        value,
        threshold: getMetricThreshold(metricName),
        status: evaluatePerformanceStatus(metricName, value),
        trend: calculatePerformanceTrend(metricName, value),
        userImpact: assessUserImpact(metricName, value)
    };

    mixpanel.track(ANALYTICS_EVENTS.PERFORMANCE, {
        ...performanceContext,
        ...systemContext,
        ...metadata
    });
};

/**
 * Sets user context with enhanced tracking
 * @param user - User object
 * @param segments - User segment information
 * @param engagement - User engagement metrics
 */
export const setUserContext = (
    user: User,
    segments: Record<string, any> = {},
    engagement: Record<string, any> = {}
): void => {
    if (!user?.id || !user?.email) {
        console.error('Valid user object required for context setting');
        return;
    }

    const userProperties = {
        userId: user.id,
        email: user.email,
        firstSeen: engagement.firstSeen ?? new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        sessionCount: engagement.sessionCount ?? 1,
        segments: {
            ...segments,
            userType: calculateUserType(engagement),
            engagementLevel: calculateEngagementLevel(engagement)
        }
    };

    mixpanel.identify(user.id);
    mixpanel.people.set({
        ...userProperties,
        ...engagement
    });
};

// Utility functions for analytics processing
const generateSessionId = (): string => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const calculateErrorImpact = (severity: string, context: Record<string, any>): string => {
    // Implementation for error impact calculation
    return 'medium';
};

const getMetricThreshold = (metricName: string): number => {
    const thresholds: Record<string, number> = {
        [PERFORMANCE_METRICS.DASHBOARD_LOAD]: 3000, // 3 seconds
        [PERFORMANCE_METRICS.API_LATENCY]: 1000,    // 1 second
        [PERFORMANCE_METRICS.RENDER_TIME]: 500      // 500ms
    };
    return thresholds[metricName] ?? 0;
};

const evaluatePerformanceStatus = (metricName: string, value: number): string => {
    const threshold = getMetricThreshold(metricName);
    return value <= threshold ? 'good' : 'poor';
};

const calculatePerformanceTrend = (metricName: string, value: number): string => {
    // Implementation for performance trend calculation
    return 'stable';
};

const assessUserImpact = (metricName: string, value: number): string => {
    // Implementation for user impact assessment
    return 'low';
};

const calculateUserType = (engagement: Record<string, any>): string => {
    // Implementation for user type calculation
    return 'regular';
};

const calculateEngagementLevel = (engagement: Record<string, any>): string => {
    // Implementation for engagement level calculation
    return 'medium';
};

// Platform-specific utility functions (to be implemented based on platform)
const getPlatform = () => 'react-native';
const getOSVersion = () => '1.0';
const getAppVersion = () => '1.0.0';
const getDeviceModel = () => 'unknown';
const getNetworkType = () => 'unknown';
const getNetworkStrength = () => 'unknown';
const getNetworkCarrier = () => 'unknown';