import React, { memo, useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import Card from '../../components/common/Card';
import type { ProfileStackNavigationProp } from '../../types/navigation';

/**
 * Enhanced profile screen component with security features and responsive design
 */
const ProfileScreen = memo(() => {
  // Hooks initialization
  const navigation = useNavigation<ProfileStackNavigationProp>();
  const { currentUser, logout, mfaStatus, sessionInfo } = useAuth();
  const { theme, breakpoints } = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  // Create styles with current theme
  const styles = createStyles(theme, breakpoints);

  /**
   * Enhanced settings navigation with state preservation
   */
  const handleSettingsPress = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  /**
   * Enhanced security settings navigation with validation
   */
  const handleSecurityPress = useCallback(() => {
    navigation.navigate('Security');
  }, [navigation]);

  /**
   * Secure logout process with session cleanup
   */
  const handleLogoutPress = useCallback(async () => {
    try {
      Alert.alert(
        'Confirm Logout',
        'Are you sure you want to logout? This will end all active sessions.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              setIsLoading(true);
              await logout();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Auth' }],
              });
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to logout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [logout, navigation]);

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      testID="profile-screen"
      accessibilityLabel="Profile Screen"
    >
      {/* Profile Information */}
      <Card 
        style={styles.card}
        accessibilityLabel="Profile Information"
        testID="profile-info-card"
      >
        <Text style={styles.heading}>Profile Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{currentUser?.email}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>MFA Status</Text>
          <Text style={[
            styles.value,
            mfaStatus?.enabled ? styles.securityEnabled : styles.securityDisabled
          ]}>
            {mfaStatus?.enabled ? 'Enabled' : 'Disabled'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Last Login</Text>
          <Text style={styles.value}>
            {new Date(sessionInfo?.lastLogin || Date.now()).toLocaleString()}
          </Text>
        </View>
      </Card>

      {/* Account Settings */}
      <Card 
        style={styles.card}
        onPress={handleSettingsPress}
        accessibilityLabel="Account Settings"
        testID="settings-card"
      >
        <Text style={styles.heading}>Account Settings</Text>
        <Text style={styles.description}>
          Manage your account preferences, notifications, and connected accounts
        </Text>
      </Card>

      {/* Security Settings */}
      <Card 
        style={styles.card}
        onPress={handleSecurityPress}
        accessibilityLabel="Security Settings"
        testID="security-card"
      >
        <Text style={styles.heading}>Security Settings</Text>
        <Text style={styles.description}>
          Configure MFA, biometric login, and session management
        </Text>
      </Card>

      {/* Logout Button */}
      <Card 
        style={[styles.card, styles.logoutCard]}
        onPress={handleLogoutPress}
        disabled={isLoading}
        accessibilityLabel="Logout"
        testID="logout-card"
      >
        <Text style={[styles.heading, styles.logoutText]}>Logout</Text>
        <Text style={[styles.description, styles.logoutDescription]}>
          End all active sessions and return to login
        </Text>
      </Card>
    </ScrollView>
  );
});

/**
 * Creates responsive stylesheet with theme integration
 */
const createStyles = (theme: Theme, breakpoints: BreakpointsTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  contentContainer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  card: {
    marginBottom: theme.spacing.md,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'transform 0.2s ease-in-out',
        ':hover': {
          transform: 'translateY(-2px)',
        },
      },
    }),
  },
  heading: {
    ...theme.typography.fontFamily.medium,
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  description: {
    ...theme.typography.fontFamily.regular,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.primary,
  },
  label: {
    ...theme.typography.fontFamily.regular,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
  },
  value: {
    ...theme.typography.fontFamily.medium,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.primary,
  },
  securityEnabled: {
    color: theme.colors.status.success,
  },
  securityDisabled: {
    color: theme.colors.status.error,
  },
  logoutCard: {
    backgroundColor: theme.colors.status.errorLight,
    marginTop: theme.spacing.xl,
  },
  logoutText: {
    color: theme.colors.status.error,
  },
  logoutDescription: {
    color: theme.colors.status.error,
  },
});

// Export memoized component
export default ProfileScreen;