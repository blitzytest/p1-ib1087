/**
 * Enhanced notification service implementation for the Mint Clone application
 * Handles push notifications, budget alerts, and sync status notifications
 * with SLA tracking and delivery confirmation
 * @version 1.0.0
 */

import messaging from '@react-native-firebase/messaging'; // ^16.0.0
import PushNotification from 'react-native-push-notification'; // ^8.1.1
import { Platform } from 'react-native';
import { NotificationPreference } from '../../types';

// Notification Types and Channel IDs
enum NotificationType {
  BUDGET_ALERT = 'BUDGET_ALERT',
  SYNC_COMPLETE = 'SYNC_COMPLETE',
  SYSTEM = 'SYSTEM'
}

const CHANNEL_IDS = {
  BUDGET: 'mint_clone_budget_alerts',
  SYNC: 'mint_clone_sync_status',
  SYSTEM: 'mint_clone_system'
};

// SLA Configuration
const SLA_CONFIG = {
  SYNC_NOTIFICATION: 30000, // 30 seconds in ms
  BUDGET_ALERT: 5000, // 5 seconds in ms
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000
};

// Interfaces
interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal';
}

interface NotificationPreferences {
  email: boolean;
  push: boolean;
  budgetAlerts: boolean;
}

interface DeliveryMetrics {
  startTime: number;
  endTime?: number;
  attempts: number;
  success: boolean;
}

/**
 * Enhanced notification service with SLA tracking and delivery confirmation
 */
class NotificationService {
  private static instance: NotificationService;
  private isInitialized: boolean = false;
  private currentToken: string | null = null;
  private preferences: NotificationPreferences;
  private deliveryMetrics: Map<string, DeliveryMetrics>;
  private offlineQueue: NotificationPayload[];

  private constructor() {
    this.preferences = {
      email: true,
      push: true,
      budgetAlerts: true
    };
    this.deliveryMetrics = new Map();
    this.offlineQueue = [];
  }

  /**
   * Gets singleton instance of NotificationService
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initializes notification service with enhanced tracking capabilities
   */
  public async initialize(): Promise<void> {
    try {
      // Request permissions with strict validation
      const authStatus = await messaging().requestPermission();
      if (authStatus !== messaging.AuthorizationStatus.AUTHORIZED) {
        throw new Error('Notification permissions denied');
      }

      // Configure platform-specific notification channels
      if (Platform.OS === 'android') {
        this.configureAndroidChannels();
      }

      // Initialize Firebase messaging
      const token = await messaging().getToken();
      await this.registerToken(token);

      // Set up background message handler
      messaging().setBackgroundMessageHandler(this.handleBackgroundMessage);

      // Configure foreground message handling
      messaging().onMessage(this.handleForegroundMessage);

      // Set up token refresh listener
      messaging().onTokenRefresh(this.registerToken);

      this.isInitialized = true;
    } catch (error) {
      console.error('Notification initialization failed:', error);
      throw error;
    }
  }

  /**
   * Displays notification with delivery confirmation and SLA tracking
   */
  public async show(payload: NotificationPayload): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('NotificationService not initialized');
    }

    const notificationId = `${Date.now()}-${Math.random()}`;
    this.deliveryMetrics.set(notificationId, {
      startTime: Date.now(),
      attempts: 1,
      success: false
    });

    try {
      // Validate payload
      this.validatePayload(payload);

      // Check user preferences
      if (!this.shouldShowNotification(payload)) {
        return;
      }

      // Format notification content
      const formattedPayload = this.formatPayload(payload);

      // Attempt delivery with retry logic
      await this.deliverNotification(notificationId, formattedPayload);

      // Update metrics on success
      this.updateDeliveryMetrics(notificationId, true);

      // Check SLA compliance
      this.checkSLACompliance(notificationId, payload.type);
    } catch (error) {
      console.error('Notification delivery failed:', error);
      this.updateDeliveryMetrics(notificationId, false);
      
      // Queue for offline delivery if appropriate
      if (this.shouldQueueOffline(payload)) {
        this.offlineQueue.push(payload);
      }
      
      throw error;
    }
  }

  /**
   * Registers FCM device token with enhanced validation
   */
  public async registerToken(token: string): Promise<void> {
    try {
      // Validate token format
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid token format');
      }

      this.currentToken = token;

      // TODO: Send token to backend API
      // await api.registerNotificationToken(token);
    } catch (error) {
      console.error('Token registration failed:', error);
      throw error;
    }
  }

  /**
   * Updates notification preferences with validation
   */
  public async updatePreferences(preferences: NotificationPreferences): Promise<void> {
    try {
      // Validate preference settings
      this.validatePreferences(preferences);

      this.preferences = {
        ...this.preferences,
        ...preferences
      };

      // Update channel configurations if needed
      if (Platform.OS === 'android') {
        await this.updateAndroidChannels();
      }

      // TODO: Sync preferences with backend
      // await api.updateNotificationPreferences(preferences);
    } catch (error) {
      console.error('Preference update failed:', error);
      throw error;
    }
  }

  /**
   * Clears notifications with state verification
   */
  public async clear(): Promise<void> {
    try {
      PushNotification.cancelAllLocalNotifications();
      this.deliveryMetrics.clear();
      this.offlineQueue = [];
    } catch (error) {
      console.error('Clear notifications failed:', error);
      throw error;
    }
  }

  /**
   * Handles background messages with priority queue
   */
  private async handleBackgroundMessage(message: messaging.RemoteMessage): Promise<void> {
    try {
      const payload = this.parseMessageToPayload(message);
      await this.show(payload);
    } catch (error) {
      console.error('Background message handling failed:', error);
    }
  }

  /**
   * Handles foreground messages with immediate display
   */
  private handleForegroundMessage = async (message: messaging.RemoteMessage): Promise<void> => {
    try {
      const payload = this.parseMessageToPayload(message);
      await this.show(payload);
    } catch (error) {
      console.error('Foreground message handling failed:', error);
    }
  };

  /**
   * Configures Android notification channels
   */
  private configureAndroidChannels(): void {
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: CHANNEL_IDS.BUDGET,
          channelName: 'Budget Alerts',
          channelDescription: 'Budget threshold notifications',
          importance: 4,
          vibrate: true
        },
        () => {}
      );

      PushNotification.createChannel(
        {
          channelId: CHANNEL_IDS.SYNC,
          channelName: 'Sync Status',
          channelDescription: 'Account synchronization notifications',
          importance: 3,
          vibrate: true
        },
        () => {}
      );

      PushNotification.createChannel(
        {
          channelId: CHANNEL_IDS.SYSTEM,
          channelName: 'System Notifications',
          channelDescription: 'System-level notifications',
          importance: 3,
          vibrate: true
        },
        () => {}
      );
    }
  }

  // Helper methods
  private validatePayload(payload: NotificationPayload): void {
    if (!payload.type || !payload.title || !payload.message) {
      throw new Error('Invalid notification payload');
    }
  }

  private validatePreferences(preferences: NotificationPreferences): void {
    if (typeof preferences.email !== 'boolean' ||
        typeof preferences.push !== 'boolean' ||
        typeof preferences.budgetAlerts !== 'boolean') {
      throw new Error('Invalid preference format');
    }
  }

  private shouldShowNotification(payload: NotificationPayload): boolean {
    if (payload.type === NotificationType.BUDGET_ALERT && !this.preferences.budgetAlerts) {
      return false;
    }
    return this.preferences.push;
  }

  private formatPayload(payload: NotificationPayload): any {
    return {
      channelId: this.getChannelId(payload.type),
      title: payload.title,
      message: payload.message,
      data: payload.data,
      priority: payload.priority || 'normal',
      importance: payload.type === NotificationType.BUDGET_ALERT ? 'high' : 'normal'
    };
  }

  private getChannelId(type: NotificationType): string {
    switch (type) {
      case NotificationType.BUDGET_ALERT:
        return CHANNEL_IDS.BUDGET;
      case NotificationType.SYNC_COMPLETE:
        return CHANNEL_IDS.SYNC;
      default:
        return CHANNEL_IDS.SYSTEM;
    }
  }

  private async deliverNotification(id: string, payload: any): Promise<void> {
    let attempts = 0;
    while (attempts < SLA_CONFIG.MAX_RETRIES) {
      try {
        PushNotification.localNotification(payload);
        return;
      } catch (error) {
        attempts++;
        if (attempts === SLA_CONFIG.MAX_RETRIES) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, SLA_CONFIG.RETRY_DELAY));
      }
    }
  }

  private updateDeliveryMetrics(id: string, success: boolean): void {
    const metrics = this.deliveryMetrics.get(id);
    if (metrics) {
      metrics.endTime = Date.now();
      metrics.success = success;
      this.deliveryMetrics.set(id, metrics);
    }
  }

  private checkSLACompliance(id: string, type: NotificationType): void {
    const metrics = this.deliveryMetrics.get(id);
    if (!metrics || !metrics.endTime) return;

    const deliveryTime = metrics.endTime - metrics.startTime;
    const slaLimit = type === NotificationType.SYNC_COMPLETE
      ? SLA_CONFIG.SYNC_NOTIFICATION
      : SLA_CONFIG.BUDGET_ALERT;

    if (deliveryTime > slaLimit) {
      console.warn(`SLA violation: ${type} notification exceeded ${slaLimit}ms limit`);
      // TODO: Report SLA violation to monitoring system
    }
  }

  private shouldQueueOffline(payload: NotificationPayload): boolean {
    return payload.type === NotificationType.BUDGET_ALERT;
  }

  private parseMessageToPayload(message: messaging.RemoteMessage): NotificationPayload {
    return {
      type: message.data?.type as NotificationType || NotificationType.SYSTEM,
      title: message.notification?.title || '',
      message: message.notification?.body || '',
      data: message.data,
      priority: message.priority as 'high' | 'normal'
    };
  }
}

export default NotificationService.getInstance();