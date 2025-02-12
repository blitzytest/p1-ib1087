/**
 * Enhanced Analytics Service Implementation
 * Provides comprehensive tracking of user interactions, performance metrics,
 * and business events with offline support and privacy compliance
 * @version 1.0.0
 */

import Mixpanel from 'mixpanel-react-native'; // v2.3.0
import AsyncStorage from '@react-native-async-storage/async-storage'; // v1.19.0
import { User } from '../../types/models';
import { ANALYTICS_EVENTS } from '../../utils/analytics';

// Configuration constants
const MIXPANEL_TOKEN = process.env.MIXPANEL_TOKEN;
const BATCH_SIZE = 50;
const RETRY_ATTEMPTS = 3;
const OFFLINE_QUEUE_KEY = '@analytics_queue';

/**
 * Analytics event interface for type safety
 */
interface AnalyticsEvent {
  eventName: string;
  properties: Record<string, any>;
  timestamp: number;
  userId?: string;
}

/**
 * Privacy settings configuration interface
 */
interface PrivacySettings {
  dataRetention: number;
  anonymizeIp: boolean;
  restrictedProperties: string[];
  gdprCompliant: boolean;
}

/**
 * Enhanced analytics service with offline support and privacy compliance
 */
class AnalyticsService {
  private mixpanel: Mixpanel;
  private initialized: boolean = false;
  private offlineQueue: AnalyticsEvent[] = [];
  private isOnline: boolean = true;
  private privacySettings: PrivacySettings;

  constructor() {
    this.mixpanel = new Mixpanel(MIXPANEL_TOKEN);
    this.initializeNetworkListener();
    this.loadOfflineQueue();
    this.initializePrivacySettings();
  }

  /**
   * Initializes the analytics service with retry mechanism
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    let attempts = 0;
    while (attempts < RETRY_ATTEMPTS) {
      try {
        await this.mixpanel.init();
        this.initialized = true;
        await this.processOfflineQueue();
        return;
      } catch (error) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
    throw new Error('Failed to initialize analytics service');
  }

  /**
   * Tracks screen views with performance metrics
   */
  public async trackScreen(
    screenName: string,
    properties: Record<string, any> = {}
  ): Promise<void> {
    const startTime = performance.now();
    const event: AnalyticsEvent = {
      eventName: ANALYTICS_EVENTS.SCREEN_VIEW,
      properties: {
        screenName,
        ...properties,
        loadTime: performance.now() - startTime,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    };

    await this.trackEvent(event);
  }

  /**
   * Tracks performance metrics with thresholds
   */
  public async trackMetric(
    metricName: string,
    value: number,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const event: AnalyticsEvent = {
      eventName: ANALYTICS_EVENTS.PERFORMANCE,
      properties: {
        metricName,
        value,
        ...metadata,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    };

    await this.trackEvent(event);
  }

  /**
   * Sets user identity with privacy compliance
   */
  public async setUser(user: User): Promise<void> {
    if (!this.initialized) return;

    const sanitizedUser = this.sanitizeUserData(user);
    await this.mixpanel.identify(sanitizedUser.id);
    await this.mixpanel.people.set({
      $email: sanitizedUser.email,
      $created: user.createdAt,
      $last_login: user.lastLogin
    });
  }

  /**
   * Configures privacy and data handling settings
   */
  public setPrivacyCompliance(settings: PrivacySettings): void {
    this.privacySettings = {
      ...this.privacySettings,
      ...settings
    };
    this.mixpanel.setGDPRCompliance(settings.gdprCompliant);
    this.mixpanel.anonymizeIP(settings.anonymizeIp);
  }

  /**
   * Core event tracking with offline support
   */
  private async trackEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.isOnline) {
      await this.queueEvent(event);
      return;
    }

    try {
      if (this.initialized) {
        const sanitizedEvent = this.sanitizeEventData(event);
        await this.mixpanel.track(
          sanitizedEvent.eventName,
          sanitizedEvent.properties
        );
      } else {
        await this.queueEvent(event);
      }
    } catch (error) {
      await this.queueEvent(event);
    }
  }

  /**
   * Processes offline event queue in batches
   */
  private async processOfflineQueue(): Promise<void> {
    if (!this.isOnline || !this.initialized) return;

    while (this.offlineQueue.length > 0) {
      const batch = this.offlineQueue.splice(0, BATCH_SIZE);
      try {
        await Promise.all(
          batch.map(event =>
            this.mixpanel.track(event.eventName, event.properties)
          )
        );
        await this.persistQueue();
      } catch (error) {
        this.offlineQueue.unshift(...batch);
        break;
      }
    }
  }

  /**
   * Queues events for offline processing
   */
  private async queueEvent(event: AnalyticsEvent): Promise<void> {
    this.offlineQueue.push(event);
    await this.persistQueue();
  }

  /**
   * Persists offline queue to storage
   */
  private async persistQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        OFFLINE_QUEUE_KEY,
        JSON.stringify(this.offlineQueue)
      );
    } catch (error) {
      console.error('Failed to persist analytics queue:', error);
    }
  }

  /**
   * Loads persisted offline queue
   */
  private async loadOfflineQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (queueData) {
        this.offlineQueue = JSON.parse(queueData);
      }
    } catch (error) {
      console.error('Failed to load analytics queue:', error);
    }
  }

  /**
   * Initializes network status listener
   */
  private initializeNetworkListener(): void {
    // Network status change listener implementation
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processOfflineQueue();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * Initializes default privacy settings
   */
  private initializePrivacySettings(): void {
    this.privacySettings = {
      dataRetention: 90, // days
      anonymizeIp: true,
      restrictedProperties: ['password', 'ssn', 'creditCard'],
      gdprCompliant: true
    };
  }

  /**
   * Sanitizes user data according to privacy settings
   */
  private sanitizeUserData(user: User): User {
    const sanitized = { ...user };
    if (this.privacySettings.anonymizeIp) {
      delete sanitized.lastLogin;
    }
    return sanitized;
  }

  /**
   * Sanitizes event data according to privacy settings
   */
  private sanitizeEventData(event: AnalyticsEvent): AnalyticsEvent {
    const sanitized = { ...event };
    this.privacySettings.restrictedProperties.forEach(prop => {
      delete sanitized.properties[prop];
    });
    return sanitized;
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();