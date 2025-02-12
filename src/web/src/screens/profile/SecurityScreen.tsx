import React, { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import { BiometricService } from '../../services/biometrics';
import { SecurityComponents } from '@security/components';
import DeviceInfo from 'react-native-device-info';
import { SecurityService } from '@security/core';
import { useTheme } from '../../hooks/useTheme';
import { VALIDATION_RULES, FEATURE_FLAGS } from '../../config/constants';

// Destructure components for cleaner usage
const {
  PasswordChangeForm,
  MfaSetupCard,
  BiometricSetupCard,
  SessionManagementCard,
  SecurityAuditCard
} = SecurityComponents;

interface SecurityScreenProps {
  navigation: NavigationProp<ProfileStackParamList>;
  route: RouteProp<ProfileStackParamList, 'Security'>;
}

interface SecuritySettings {
  mfaEnabled: boolean;
  biometricEnabled: boolean;
  activeSessions: Session[];
  passwordLastChanged: Date;
}

export const SecurityScreen: React.FC<SecurityScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const { currentUser, isLoading, updateSecuritySettings } = useAuth();
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    mfaEnabled: false,
    biometricEnabled: false,
    activeSessions: [],
    passwordLastChanged: new Date()
  });

  // Load initial security settings
  useEffect(() => {
    const loadSecuritySettings = async () => {
      try {
        const settings = await SecurityService.getUserSecuritySettings(currentUser.id);
        setSecuritySettings(settings);
      } catch (error) {
        console.error('Failed to load security settings:', error);
      }
    };

    loadSecuritySettings();
  }, [currentUser.id]);

  // Handle password change with validation and history check
  const handlePasswordChange = useCallback(async (
    currentPassword: string,
    newPassword: string,
    mfaCode?: string
  ) => {
    try {
      // Validate password strength
      if (!VALIDATION_RULES.PASSWORD_PATTERN.test(newPassword)) {
        throw new Error('Password does not meet security requirements');
      }

      // Verify current password and MFA if enabled
      await SecurityService.verifyCredentials({
        userId: currentUser.id,
        password: currentPassword,
        mfaCode
      });

      // Update password
      await updateSecuritySettings({
        type: 'password',
        newValue: newPassword
      });

      setSecuritySettings(prev => ({
        ...prev,
        passwordLastChanged: new Date()
      }));

      return { success: true };
    } catch (error) {
      console.error('Password change failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }, [currentUser.id, updateSecuritySettings]);

  // Handle MFA configuration
  const handleMfaConfiguration = useCallback(async (
    enabled: boolean,
    authenticatorType: 'app' | 'sms'
  ) => {
    try {
      const mfaConfig = await SecurityService.configureMfa({
        userId: currentUser.id,
        enabled,
        type: authenticatorType
      });

      setSecuritySettings(prev => ({
        ...prev,
        mfaEnabled: enabled
      }));

      return {
        success: true,
        qrCode: mfaConfig.qrCode,
        backupCodes: mfaConfig.backupCodes
      };
    } catch (error) {
      console.error('MFA configuration failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }, [currentUser.id]);

  // Handle biometric authentication setup
  const handleBiometricSetup = useCallback(async (enabled: boolean) => {
    try {
      if (enabled) {
        // Check biometric capability
        const biometricStatus = await BiometricService.validateBiometricCapability();
        if (!biometricStatus.available) {
          throw new Error('Biometric authentication not available');
        }

        // Check biometric strength
        const strengthCheck = await BiometricService.checkBiometricStrength();
        if (!strengthCheck.isStrong) {
          throw new Error('Biometric security level insufficient');
        }

        // Store credentials securely
        await BiometricService.securelyStoreCredentials({
          userId: currentUser.id,
          deviceId: await DeviceInfo.getUniqueId()
        });
      } else {
        await SecurityService.disableBiometrics(currentUser.id);
      }

      setSecuritySettings(prev => ({
        ...prev,
        biometricEnabled: enabled
      }));

      return { success: true };
    } catch (error) {
      console.error('Biometric setup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }, [currentUser.id]);

  // Handle session management
  const handleSessionManagement = useCallback(async (sessionId: string, action: 'terminate' | 'renew') => {
    try {
      if (action === 'terminate') {
        await SecurityService.terminateSession(sessionId);
      } else {
        await SecurityService.renewSession(sessionId);
      }

      const updatedSessions = await SecurityService.getActiveSessions(currentUser.id);
      setSecuritySettings(prev => ({
        ...prev,
        activeSessions: updatedSessions
      }));

      return { success: true };
    } catch (error) {
      console.error('Session management failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }, [currentUser.id]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Password Management Section */}
        <PasswordChangeForm
          onSubmit={handlePasswordChange}
          lastChanged={securitySettings.passwordLastChanged}
          style={styles.section}
        />

        {/* MFA Configuration Section */}
        <MfaSetupCard
          enabled={securitySettings.mfaEnabled}
          onToggle={handleMfaConfiguration}
          style={styles.section}
        />

        {/* Biometric Authentication Section */}
        {FEATURE_FLAGS.ENABLE_BIOMETRICS && (
          <BiometricSetupCard
            enabled={securitySettings.biometricEnabled}
            onToggle={handleBiometricSetup}
            style={styles.section}
          />
        )}

        {/* Session Management Section */}
        <SessionManagementCard
          sessions={securitySettings.activeSessions}
          onSessionAction={handleSessionManagement}
          style={styles.section}
        />

        {/* Security Audit Section */}
        <SecurityAuditCard
          userId={currentUser.id}
          style={styles.section}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white'
  },
  content: {
    padding: 16
  },
  section: {
    marginBottom: 24
  }
});

export default SecurityScreen;