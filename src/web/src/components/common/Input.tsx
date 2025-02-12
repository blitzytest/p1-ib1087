import React, { useCallback, useRef, useState } from 'react';
import {
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
  Animated,
  View,
  Text,
  AccessibilityRole,
} from 'react-native'; // 0.71+
import { useTheme } from '../../hooks/useTheme';

interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  label?: string;
  error?: string;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  testID?: string;
  accessibilityLabel?: string;
  autoFocus?: boolean;
  maxLength?: number;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  multiline?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

const Input: React.FC<InputProps> = React.memo(({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  label,
  error,
  disabled = false,
  containerStyle,
  inputStyle,
  testID,
  accessibilityLabel,
  autoFocus = false,
  maxLength,
  keyboardType = 'default',
  multiline = false,
  onFocus,
  onBlur,
}) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  // Memoized styles to prevent unnecessary recalculations
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Handle focus animation
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onFocus?.();
  }, [focusAnim, onFocus]);

  // Handle blur animation
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onBlur?.();
  }, [focusAnim, onBlur]);

  // Dynamic input container style based on state
  const inputContainerStyle = React.useMemo(() => [
    styles.input,
    isFocused && styles.inputFocused,
    error && styles.inputError,
    disabled && styles.inputDisabled,
    inputStyle,
  ], [styles, isFocused, error, disabled, inputStyle]);

  return (
    <View 
      style={[styles.container, containerStyle]}
      accessibilityRole="none"
      testID={`${testID}-container`}
    >
      {label && (
        <Text
          style={styles.label}
          accessibilityRole="text"
          testID={`${testID}-label`}
        >
          {label}
        </Text>
      )}

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.text.tertiary}
        secureTextEntry={secureTextEntry}
        editable={!disabled}
        style={inputContainerStyle}
        onFocus={handleFocus}
        onBlur={handleBlur}
        testID={testID}
        accessibilityLabel={accessibilityLabel || label}
        accessibilityRole="textbox"
        accessibilityState={{
          disabled,
          invalid: !!error,
        }}
        autoFocus={autoFocus}
        maxLength={maxLength}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...Platform.select({
          ios: {
            autoCorrect: false,
            autoCapitalize: 'none',
          },
          android: {
            autoComplete: 'off',
          },
        })}
      />

      {error && (
        <Text
          style={styles.error}
          accessibilityRole="alert"
          testID={`${testID}-error`}
        >
          {error}
        </Text>
      )}
    </View>
  );
});

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    marginVertical: theme.spacing.sm,
    width: '100%',
  },
  label: {
    marginBottom: theme.spacing.xs,
    color: theme.colors.text.primary,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background.secondary,
    borderColor: theme.colors.border.primary,
    ...Platform.select({
      ios: {
        paddingVertical: theme.spacing.sm,
      },
      android: {
        paddingVertical: theme.spacing.xs,
      },
    }),
  },
  inputFocused: {
    borderColor: theme.colors.brand.primary,
    shadowColor: theme.colors.brand.primary,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  inputDisabled: {
    backgroundColor: theme.colors.background.disabled,
    borderColor: theme.colors.border.secondary,
    opacity: 0.7,
  },
  inputError: {
    borderColor: theme.colors.status.error,
  },
  error: {
    color: theme.colors.status.error,
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily.regular,
  },
});

Input.displayName = 'Input';

export default Input;