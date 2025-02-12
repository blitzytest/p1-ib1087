import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { jest } from '@jest/globals';
import { axe } from '@axe-core/react';
import { Theme } from '@mui/material';
import Alert from '../../src/components/common/Alert';
import Button from '../../src/components/common/Button';
import Input from '../../src/components/common/Input';

// Mock theme hook
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        brand: {
          primary: '#00A6A4',
          secondary: '#0B3954'
        },
        text: {
          primary: '#0B3954',
          secondary: '#4F6D7A',
          tertiary: '#6B7C85',
          inverse: '#FFFFFF'
        },
        status: {
          success: '#4CAF50',
          warning: '#FFC107',
          error: '#F44336',
          info: '#2196F3',
          successLight: '#4CAF5020',
          warningLight: '#FFC10720',
          errorLight: '#F4433620',
          infoLight: '#2196F320'
        },
        background: {
          primary: '#FFFFFF',
          secondary: '#F5F7F9',
          disabled: '#E1E8ED'
        },
        border: {
          primary: '#E1E8ED',
          secondary: '#CBD5DC'
        }
      },
      spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32
      },
      typography: {
        fontSize: {
          sm: 14,
          md: 16,
          lg: 18
        },
        fontFamily: {
          regular: 'System',
          medium: 'System-Medium'
        }
      }
    }
  })
}));

// Mock animations
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

describe('Alert Component', () => {
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    mockOnDismiss.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('renders success alert with correct styling and accessibility', () => {
    const { getByRole, getByText } = render(
      <Alert
        message="Operation successful"
        type="success"
        visible={true}
        testID="success-alert"
      />
    );

    const alert = getByRole('alert');
    const message = getByText('Operation successful');

    expect(alert).toBeTruthy();
    expect(message).toBeTruthy();
    expect(alert.props.accessibilityLabel).toBe('success alert: Operation successful');
  });

  test('auto-dismisses after specified duration', async () => {
    render(
      <Alert
        message="Test message"
        type="info"
        visible={true}
        duration={3000}
        onDismiss={mockOnDismiss}
      />
    );

    jest.advanceTimersByTime(3000);
    await waitFor(() => {
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });
  });

  test('handles RTL layout correctly', () => {
    const { getByTestId } = render(
      <Alert
        message="RTL message"
        type="warning"
        visible={true}
        testID="rtl-alert"
      />
    );

    const alert = getByTestId('rtl-alert');
    expect(alert.props.style).toContainEqual(
      expect.objectContaining({
        right: 0,
        left: 0
      })
    );
  });
});

describe('Button Component', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  test('renders with minimum touch target size for accessibility', () => {
    const { getByRole } = render(
      <Button
        label="Test Button"
        onPress={mockOnPress}
        testID="test-button"
      />
    );

    const button = getByRole('button');
    const { height, width } = button.props.style.find(
      (style: any) => style.minHeight && style.minWidth
    );

    expect(height).toBeGreaterThanOrEqual(44);
    expect(width).toBeGreaterThanOrEqual(44);
  });

  test('handles loading state with spinner', () => {
    const { getByTestId, queryByText } = render(
      <Button
        label="Loading Button"
        onPress={mockOnPress}
        loading={true}
        testID="loading-button"
      />
    );

    const spinner = getByTestId('loading-button').findByType('ActivityIndicator');
    const label = queryByText('Loading Button');

    expect(spinner).toBeTruthy();
    expect(label).toBeNull();
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  test('applies correct styles for different variants', () => {
    const variants = ['primary', 'secondary', 'outline', 'ghost'];
    
    variants.forEach(variant => {
      const { getByTestId } = render(
        <Button
          label="Variant Button"
          onPress={mockOnPress}
          variant={variant as any}
          testID={`${variant}-button`}
        />
      );

      const button = getByTestId(`${variant}-button`);
      expect(button.props.style).toMatchSnapshot();
    });
  });
});

describe('Input Component', () => {
  const mockOnChangeText = jest.fn();

  beforeEach(() => {
    mockOnChangeText.mockClear();
  });

  test('handles secure text entry correctly', () => {
    const { getByTestId } = render(
      <Input
        value="password123"
        onChangeText={mockOnChangeText}
        secureTextEntry={true}
        testID="secure-input"
      />
    );

    const input = getByTestId('secure-input');
    expect(input.props.secureTextEntry).toBe(true);
  });

  test('shows error state with message', () => {
    const { getByTestId, getByText } = render(
      <Input
        value=""
        onChangeText={mockOnChangeText}
        error="Required field"
        testID="error-input"
      />
    );

    const input = getByTestId('error-input');
    const errorMessage = getByText('Required field');

    expect(input.props.style).toContainEqual(
      expect.objectContaining({
        borderColor: '#F44336'
      })
    );
    expect(errorMessage).toBeTruthy();
  });

  test('handles focus and blur states', async () => {
    const { getByTestId } = render(
      <Input
        value=""
        onChangeText={mockOnChangeText}
        testID="focus-input"
      />
    );

    const input = getByTestId('focus-input');
    
    fireEvent(input, 'focus');
    await waitFor(() => {
      expect(input.props.style).toContainEqual(
        expect.objectContaining({
          borderColor: '#00A6A4'
        })
      );
    });

    fireEvent(input, 'blur');
    await waitFor(() => {
      expect(input.props.style).toContainEqual(
        expect.objectContaining({
          borderColor: '#E1E8ED'
        })
      );
    });
  });

  test('applies disabled state correctly', () => {
    const { getByTestId } = render(
      <Input
        value=""
        onChangeText={mockOnChangeText}
        disabled={true}
        testID="disabled-input"
      />
    );

    const input = getByTestId('disabled-input');
    expect(input.props.editable).toBe(false);
    expect(input.props.style).toContainEqual(
      expect.objectContaining({
        backgroundColor: '#E1E8ED',
        opacity: 0.7
      })
    );
  });
});