import React, { useEffect, useCallback, useRef } from 'react';
import {
  Modal as RNModal,
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Platform,
  Pressable,
  Text,
} from 'react-native'; // ^0.71+
import { useTheme } from '../../hooks/useTheme';

// Animation types supported by the modal
type ModalAnimationType = 'slide' | 'fade';

// Props interface for the Modal component
interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  containerStyle?: object;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  animationType?: ModalAnimationType;
  animationDuration?: number;
  accessibilityProps?: {
    label?: string;
    hint?: string;
  };
  onAnimationComplete?: () => void;
}

/**
 * Custom hook to manage modal animation values and performance
 */
const useModalAnimation = (
  visible: boolean,
  duration: number,
  type: ModalAnimationType
) => {
  const animationValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startTime = performance.now();

    Animated.timing(animationValue, {
      toValue: visible ? 1 : 0,
      duration,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        const endTime = performance.now();
        const animationDuration = endTime - startTime;
        
        // Log performance metrics if animation takes too long
        if (animationDuration > 16) { // 60fps threshold
          console.warn('Modal animation performance warning', {
            duration: animationDuration,
            type,
          });
        }
      }
    });
  }, [visible, duration, type, animationValue]);

  const getAnimationStyle = useCallback(() => {
    const baseStyle = {
      opacity: animationValue,
    };

    if (type === 'slide') {
      return {
        ...baseStyle,
        transform: [{
          translateY: animationValue.interpolate({
            inputRange: [0, 1],
            outputRange: [50, 0],
          }),
        }],
      };
    }

    return baseStyle;
  }, [animationValue, type]);

  return { animationValue, getAnimationStyle };
};

/**
 * Custom hook to handle keyboard escape key for modal dismissal
 */
const useKeyboardDismiss = (onClose: () => void, visible: boolean) => {
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && visible) {
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [onClose, visible]);
};

/**
 * Modal component providing a flexible overlay dialog system
 * with customizable content, animations, and accessibility features
 */
export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  children,
  title,
  containerStyle,
  closeOnBackdrop = true,
  showCloseButton = true,
  animationType = 'fade',
  animationDuration = 300,
  accessibilityProps = {},
  onAnimationComplete,
}) => {
  const { theme, currentBreakpoint } = useTheme();
  const { width } = useWindowDimensions();

  // Animation handling
  const { getAnimationStyle } = useModalAnimation(
    visible,
    animationDuration,
    animationType
  );

  // Keyboard handling
  useKeyboardDismiss(onClose, visible);

  // Calculate modal width based on breakpoint
  const getModalWidth = useCallback(() => {
    switch (currentBreakpoint) {
      case 'desktop':
        return width * 0.5;
      case 'tablet':
        return width * 0.7;
      default:
        return width * 0.9;
    }
  }, [currentBreakpoint, width]);

  return (
    <RNModal
      visible={visible}
      transparent
      onRequestClose={onClose}
      animationType="none"
      statusBarTranslucent
      {...Platform.select({
        web: {
          'aria-modal': true,
          role: 'dialog',
          'aria-label': accessibilityProps.label || 'Modal dialog',
        },
      })}
    >
      <Pressable
        style={styles.container}
        onPress={closeOnBackdrop ? onClose : undefined}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={accessibilityProps.label}
        accessibilityHint={accessibilityProps.hint || 'Press escape to close'}
      >
        <Animated.View
          style={[
            styles.content,
            getAnimationStyle(),
            {
              width: getModalWidth(),
              backgroundColor: theme.colors.background.modal,
              borderRadius: theme.spacing.md,
              padding: theme.spacing.lg,
            },
            containerStyle,
          ]}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {title && (
            <View style={styles.header}>
              <Text
                style={[
                  styles.title,
                  {
                    color: theme.colors.text.primary,
                    fontSize: theme.typography.fontSize.lg,
                    fontFamily: theme.typography.fontFamily.medium,
                  },
                ]}
              >
                {title}
              </Text>
              {showCloseButton && (
                <TouchableOpacity
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close modal"
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <Text style={styles.closeButton}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {children}
        </Animated.View>
      </Pressable>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    flex: 1,
  },
  closeButton: {
    fontSize: 24,
    lineHeight: 24,
    padding: 8,
    opacity: 0.7,
  },
});

export type { ModalProps };