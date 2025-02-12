import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  AccessibilityInfo,
  Platform
} from 'react-native';
import { Modal, ModalProps } from '../common/Modal';
import { useAuth } from '../../hooks/useAuth';
import { isBiometricsAvailable } from '../../services/biometrics';
import { useTheme } from '../../hooks/useTheme';

// Interface for biometric prompt props
interface BiometricPromptProps {
  visible: boolean;
  onClose: () => void;
  credentials?: {
    email: string;
    password: string;
  };
  enablePrompt?: boolean;
  maxAttempts?: number;
  requireFallback?: boolean;
  accessibilityConfig?: {
    label?: string;
    hint?: string;
    announceResult?: boolean;
  };
}

// Interface for biometric errors
interface BiometricError {
  code: string;
  message: string;
  technical_details?: string;
  isRetryable: boolean;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const ANIMATION_DURATION = 300;

export const BiometricPrompt: React.FC<BiometricPromptProps> = ({
  visible,
  onClose,
  credentials,
  enablePrompt = false,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  requireFallback = true,
  accessibilityConfig = {}
}) => {
  const { theme } = useTheme();
  const { login, loginWithBiometrics } = useAuth();
  
  const [error, setError] = useState<BiometricError | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);
  
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;

  // Check biometric availability on mount
  useEffect(() => {
    const checkBiometrics = async () => {
      try {
        const result = await isBiometricsAvailable();
        if (result.available) {
          setBiometricType(result.biometryType);
        } else {
          setError({
            code: 'BIOMETRIC_NOT_AVAILABLE',
            message: 'Biometric authentication is not available',
            technical_details: result.error,
            isRetryable: false
          });
        }
      } catch (err) {
        console.error('Biometric check failed:', err);
      }
    };
    
    if (visible) {
      checkBiometrics();
    }
  }, [visible]);

  // Handle biometric setup
  const handleBiometricSetup = useCallback(async () => {
    if (!credentials) {
      setError({
        code: 'INVALID_CREDENTIALS',
        message: 'No credentials provided for biometric setup',
        isRetryable: false
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Attempt login first to validate credentials
      await login(credentials, true);

      // Announce success to screen readers
      if (accessibilityConfig.announceResult) {
        AccessibilityInfo.announceForAccessibility('Biometric authentication enabled successfully');
      }

      onClose();
    } catch (err) {
      setError({
        code: 'SETUP_FAILED',
        message: 'Failed to enable biometric authentication',
        technical_details: err.message,
        isRetryable: true
      });
      
      // Trigger shake animation
      Animated.sequence([
        Animated.timing(shakeAnimation, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true
        }),
        Animated.timing(shakeAnimation, {
          toValue: -10,
          duration: 100,
          useNativeDriver: true
        }),
        Animated.timing(shakeAnimation, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true
        })
      ]).start();
    } finally {
      setIsLoading(false);
    }
  }, [credentials, login, onClose, accessibilityConfig.announceResult]);

  // Handle biometric authentication
  const handleBiometricLogin = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (attempts >= maxAttempts) {
        setError({
          code: 'MAX_ATTEMPTS_EXCEEDED',
          message: 'Too many failed attempts',
          isRetryable: false
        });
        return;
      }

      await loginWithBiometrics();

      // Announce success to screen readers
      if (accessibilityConfig.announceResult) {
        AccessibilityInfo.announceForAccessibility('Biometric authentication successful');
      }

      // Fade out animation
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true
      }).start(() => onClose());

    } catch (err) {
      setAttempts(prev => prev + 1);
      setError({
        code: err.code || 'AUTH_FAILED',
        message: err.message || 'Authentication failed',
        technical_details: err.technical_details,
        isRetryable: attempts < maxAttempts - 1
      });

      // Trigger shake animation
      Animated.sequence([
        Animated.timing(shakeAnimation, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true
        }),
        Animated.timing(shakeAnimation, {
          toValue: -10,
          duration: 100,
          useNativeDriver: true
        }),
        Animated.timing(shakeAnimation, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true
        })
      ]).start();
    } finally {
      setIsLoading(false);
    }
  }, [attempts, maxAttempts, loginWithBiometrics, onClose, accessibilityConfig.announceResult]);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      containerStyle={styles.modalContainer}
      accessibilityProps={{
        label: accessibilityConfig.label || 'Biometric authentication prompt',
        hint: accessibilityConfig.hint || 'Authenticate using biometrics'
      }}
    >
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateX: shakeAnimation }],
            opacity: fadeAnimation
          }
        ]}
      >
        <Text
          style={[styles.title, { color: theme.colors.text.primary }]}
          accessibilityRole="header"
        >
          {enablePrompt ? 'Enable Biometric Login' : 'Biometric Authentication'}
        </Text>

        <Text
          style={[styles.message, { color: theme.colors.text.secondary }]}
          accessibilityRole="text"
        >
          {enablePrompt
            ? `Use ${biometricType} for quick and secure access`
            : `Authenticate using ${biometricType}`}
        </Text>

        {error && (
          <Text
            style={[styles.errorText, { color: theme.colors.status.error }]}
            accessibilityRole="alert"
          >
            {error.message}
          </Text>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: theme.colors.brand.primary }
            ]}
            onPress={enablePrompt ? handleBiometricSetup : handleBiometricLogin}
            disabled={isLoading || (error && !error.isRetryable)}
            accessibilityRole="button"
            accessibilityLabel={enablePrompt ? 'Enable biometric login' : 'Authenticate'}
            accessibilityState={{ disabled: isLoading || (error && !error.isRetryable) }}
          >
            <Text style={[styles.buttonText, { color: theme.colors.text.inverse }]}>
              {isLoading ? 'Please wait...' : enablePrompt ? 'Enable' : 'Authenticate'}
            </Text>
          </TouchableOpacity>

          {requireFallback && (
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel biometric authentication"
            >
              <Text style={[styles.buttonText, { color: theme.colors.text.primary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  container: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4
      },
      android: {
        elevation: 5
      }
    })
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center'
  },
  message: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center'
  },
  errorText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center'
  },
  buttonContainer: {
    gap: 12
  },
  button: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E1E8ED'
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500'
  }
});

export type { BiometricPromptProps, BiometricError };