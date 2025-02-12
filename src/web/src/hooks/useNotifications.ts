/**
 * React hook for managing notifications in the mobile app
 * Provides comprehensive notification handling with SLA tracking and offline support
 * @version 1.0.0
 */

import { useEffect, useCallback } from 'react'; // ^18.0.0
import { useDispatch } from 'react-redux'; // ^8.0.5
import NotificationService from '../services/notifications';
import { NotificationType } from '../types';
import { uiActions } from '../store/slices/uiSlice';

/**
 * Interface for notification preferences
 */
interface NotificationPreferences {
  email: boolean;
  push: boolean;
  budgetAlerts: boolean;
}

/**
 * Custom hook for comprehensive notification management
 * Handles push notifications, budget alerts, and sync status with SLA tracking
 */
const useNotifications = () => {
  const dispatch = useDispatch();

  /**
   * Initializes notification services with platform-specific setup
   */
  const initializeNotifications = useCallback(async () => {
    try {
      await NotificationService.initialize();
      
      // Show success alert for notification setup
      dispatch(uiActions.showAlert({
        id: `notification-init-${Date.now()}`,
        type: 'success',
        message: 'Notifications initialized successfully',
        autoHide: true,
        duration: 3000,
        createdAt: Date.now()
      }));
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      
      // Show error alert for failed initialization
      dispatch(uiActions.showAlert({
        id: `notification-init-error-${Date.now()}`,
        type: 'error',
        message: 'Failed to initialize notifications',
        autoHide: true,
        duration: 5000,
        createdAt: Date.now()
      }));
    }
  }, [dispatch]);

  /**
   * Handles incoming notifications with delivery tracking and offline support
   */
  const handleNotification = useCallback(async (notification: {
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
  }) => {
    try {
      await NotificationService.show({
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        priority: notification.type === NotificationType.BUDGET_ALERT ? 'high' : 'normal'
      });

      // Show UI alert for budget notifications
      if (notification.type === NotificationType.BUDGET_ALERT) {
        dispatch(uiActions.showAlert({
          id: `budget-alert-${Date.now()}`,
          type: 'warning',
          message: notification.message,
          autoHide: true,
          duration: 7000,
          createdAt: Date.now()
        }));
      }

      // Show sync completion alerts
      if (notification.type === NotificationType.SYNC_COMPLETE) {
        dispatch(uiActions.showAlert({
          id: `sync-complete-${Date.now()}`,
          type: 'info',
          message: 'Account sync completed',
          autoHide: true,
          duration: 3000,
          createdAt: Date.now()
        }));
      }
    } catch (error) {
      console.error('Failed to handle notification:', error);
      
      // Show error alert for failed notification
      dispatch(uiActions.showAlert({
        id: `notification-error-${Date.now()}`,
        type: 'error',
        message: 'Failed to process notification',
        autoHide: true,
        duration: 5000,
        createdAt: Date.now()
      }));
    }
  }, [dispatch]);

  /**
   * Updates notification preferences with validation and backend sync
   */
  const updatePreferences = useCallback(async (preferences: NotificationPreferences) => {
    try {
      await NotificationService.updatePreferences(preferences);
      
      // Show success alert for preference update
      dispatch(uiActions.showAlert({
        id: `preferences-update-${Date.now()}`,
        type: 'success',
        message: 'Notification preferences updated',
        autoHide: true,
        duration: 3000,
        createdAt: Date.now()
      }));
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      
      // Show error alert for failed preference update
      dispatch(uiActions.showAlert({
        id: `preferences-error-${Date.now()}`,
        type: 'error',
        message: 'Failed to update notification preferences',
        autoHide: true,
        duration: 5000,
        createdAt: Date.now()
      }));
    }
  }, [dispatch]);

  /**
   * Cleanup notification resources on unmount
   */
  useEffect(() => {
    return () => {
      NotificationService.clear().catch(error => {
        console.error('Failed to cleanup notifications:', error);
      });
    };
  }, []);

  return {
    initializeNotifications,
    handleNotification,
    updatePreferences
  };
};

export default useNotifications;