import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Switch, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/common/Button';
import List from '../../components/common/List';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { isBiometricsAvailable } from '../../services/biometrics';
import { secureStorage } from '../../services/storage';
import { FEATURE_FLAGS } from '../../config/constants';
import { ProfileStackNavigationProp } from '../../types/navigation';

// Enhanced interface for settings items with accessibility support
interface SettingItem {
  id: string;
  title: string;
  description: string;
  enabled?: boolean;
  onToggle?: (value: boolean) => Promise<void>;
  route?: string;
  accessibilityLabel: string;
  testID: string;
  icon?: string;
  subtitle?: string;
  isLoading?: boolean;
  platformStyles?: Record<string, any>;
}

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<ProfileStackNavigationProp>();
  const { theme } = useTheme();
  const { currentUser, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Settings state management
  const [settings, setSettings] = useState({
    notifications: true,
    biometrics: false,
    darkMode: false,
    emailAlerts: true,
    pushNotifications: true
  });

  // Handle setting changes with optimistic updates and error handling
  const handleSettingChange = useCallback(async (
    settingId: string,
    value: boolean
  ) => {
    try {
      // Optimistic update
      setSettings(prev => ({ ...prev, [settingId]: value }));

      // Persist change
      await secureStorage.setItem(`setting_${settingId}`, value, {
        encrypt: true,
        ttl: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      // Handle specific setting logic
      switch (settingId) {
        case 'biometrics':
          const biometricAvailable = await isBiometricsAvailable();
          if (!biometricAvailable.available) {
            throw new Error('Biometric authentication not available');
          }
          break;
        // Add other specific setting handlers
      }
    } catch (error) {
      // Revert optimistic update
      setSettings(prev => ({ ...prev, [settingId]: !value }));
      // Show error to user (would use a toast/alert system in production)
      console.error('Failed to update setting:', error);
    }
  }, []);

  // Handle logout with proper cleanup
  const handleLogout = useCallback(async () => {
    try {
      setIsLoading(true);
      await secureStorage.clear();
      await logout();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }]
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [logout, navigation]);

  // Settings sections with enhanced accessibility
  const settingsSections = useMemo(() => [
    {
      title: 'Account',
      data: [
        {
          id: 'profile',
          title: 'Profile Information',
          description: 'Update your personal details',
          route: 'ProfileEdit',
          accessibilityLabel: 'Edit profile information',
          testID: 'profile-edit-button'
        },
        {
          id: 'security',
          title: 'Security Settings',
          description: 'Manage passwords and authentication',
          route: 'SecuritySettings',
          accessibilityLabel: 'Security settings',
          testID: 'security-settings-button'
        }
      ]
    },
    {
      title: 'Preferences',
      data: [
        {
          id: 'notifications',
          title: 'Notifications',
          description: 'Configure alerts and reminders',
          enabled: settings.notifications,
          onToggle: (value) => handleSettingChange('notifications', value),
          accessibilityLabel: 'Toggle notifications',
          testID: 'notifications-toggle'
        },
        {
          id: 'biometrics',
          title: 'Biometric Login',
          description: 'Use fingerprint or face recognition',
          enabled: settings.biometrics && FEATURE_FLAGS.ENABLE_BIOMETRICS,
          onToggle: (value) => handleSettingChange('biometrics', value),
          accessibilityLabel: 'Toggle biometric login',
          testID: 'biometrics-toggle'
        }
      ]
    },
    {
      title: 'Data & Privacy',
      data: [
        {
          id: 'dataExport',
          title: 'Export Data',
          description: 'Download your financial data',
          route: 'DataExport',
          accessibilityLabel: 'Export your data',
          testID: 'data-export-button'
        },
        {
          id: 'privacy',
          title: 'Privacy Settings',
          description: 'Manage data sharing preferences',
          route: 'PrivacySettings',
          accessibilityLabel: 'Privacy settings',
          testID: 'privacy-settings-button'
        }
      ]
    }
  ], [settings, handleSettingChange]);

  // Render individual setting item
  const renderSettingItem = useCallback(({ item }: { item: SettingItem }) => {
    const itemStyle = [
      styles.settingItem,
      item.platformStyles?.[Platform.OS]
    ];

    return (
      <View style={itemStyle}>
        <View style={styles.settingContent}>
          <View style={styles.settingHeader}>
            <View style={styles.settingTitleContainer}>
              {item.icon && <View style={styles.iconContainer} />}
              <View>
                <Text style={[styles.settingTitle, { color: theme.colors.text.primary }]}>
                  {item.title}
                </Text>
                {item.subtitle && (
                  <Text style={[styles.settingSubtitle, { color: theme.colors.text.secondary }]}>
                    {item.subtitle}
                  </Text>
                )}
              </View>
            </View>
            {item.onToggle && (
              <Switch
                value={item.enabled}
                onValueChange={item.onToggle}
                disabled={item.isLoading}
                accessibilityLabel={item.accessibilityLabel}
                testID={item.testID}
              />
            )}
          </View>
          <Text style={[styles.settingDescription, { color: theme.colors.text.tertiary }]}>
            {item.description}
          </Text>
        </View>
      </View>
    );
  }, [theme]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <List
        sections={settingsSections}
        renderItem={renderSettingItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        testID="settings-list"
        accessible={true}
        accessibilityLabel="Settings menu"
      />
      <Button
        label="Logout"
        onPress={handleLogout}
        variant="outline"
        loading={isLoading}
        style={styles.logoutButton}
        accessibilityLabel="Logout from account"
        testID="logout-button"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  settingItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  settingTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  settingDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  logoutButton: {
    margin: 16,
  },
});

export default SettingsScreen;