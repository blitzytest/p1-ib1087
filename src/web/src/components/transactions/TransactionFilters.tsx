import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, AccessibilityInfo } from 'react-native';
import DatePicker from '@react-native-community/datetimepicker';
import Input from '../common/Input';
import { useTheme } from '../../hooks/useTheme';
import { Transaction } from '../../types/models';

// Debounce delay for filter updates
const DEBOUNCE_DELAY = 300;

interface TransactionFilters {
  startDate: Date | null;
  endDate: Date | null;
  minAmount: number | null;
  maxAmount: number | null;
  category: string | null;
  searchText: string;
  isValid: boolean;
  errors: Record<string, string>;
}

interface TransactionFiltersProps {
  onFiltersChange: (filters: TransactionFilters) => void;
  initialFilters?: Partial<TransactionFilters>;
  isLoading?: boolean;
  onError?: (error: string) => void;
  categories: string[];
}

const TransactionFilters: React.FC<TransactionFiltersProps> = React.memo(({
  onFiltersChange,
  initialFilters = {},
  isLoading = false,
  onError,
  categories
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Initialize filter state
  const [filters, setFilters] = useState<TransactionFilters>({
    startDate: initialFilters.startDate || null,
    endDate: initialFilters.endDate || null,
    minAmount: initialFilters.minAmount || null,
    maxAmount: initialFilters.maxAmount || null,
    category: initialFilters.category || null,
    searchText: initialFilters.searchText || '',
    isValid: true,
    errors: {}
  });

  // Debounced filter change handler
  const debouncedFilterChange = useCallback((newFilters: TransactionFilters) => {
    const timeoutId = setTimeout(() => {
      if (newFilters.isValid) {
        onFiltersChange(newFilters);
      }
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timeoutId);
  }, [onFiltersChange]);

  // Date change handler with validation
  const handleDateChange = useCallback((type: 'start' | 'end', date: Date) => {
    setFilters(prev => {
      const newFilters = { ...prev, errors: { ...prev.errors } };
      
      if (type === 'start') {
        newFilters.startDate = date;
        delete newFilters.errors.startDate;
        
        if (prev.endDate && date > prev.endDate) {
          newFilters.errors.startDate = 'Start date must be before end date';
          newFilters.isValid = false;
        }
      } else {
        newFilters.endDate = date;
        delete newFilters.errors.endDate;
        
        if (prev.startDate && date < prev.startDate) {
          newFilters.errors.endDate = 'End date must be after start date';
          newFilters.isValid = false;
        }
      }

      newFilters.isValid = Object.keys(newFilters.errors).length === 0;
      
      // Announce date change to screen readers
      AccessibilityInfo.announceForAccessibility(
        `${type === 'start' ? 'Start' : 'End'} date set to ${date.toLocaleDateString()}`
      );

      return newFilters;
    });
  }, []);

  // Amount change handler with validation
  const handleAmountChange = useCallback((type: 'min' | 'max', value: string) => {
    setFilters(prev => {
      const newFilters = { ...prev, errors: { ...prev.errors } };
      const numValue = value ? parseFloat(value) : null;

      if (value && (isNaN(numValue!) || numValue! < 0)) {
        newFilters.errors[type === 'min' ? 'minAmount' : 'maxAmount'] = 'Invalid amount';
        newFilters.isValid = false;
      } else {
        if (type === 'min') {
          newFilters.minAmount = numValue;
          delete newFilters.errors.minAmount;
          
          if (prev.maxAmount !== null && numValue !== null && numValue > prev.maxAmount) {
            newFilters.errors.minAmount = 'Min amount must be less than max amount';
            newFilters.isValid = false;
          }
        } else {
          newFilters.maxAmount = numValue;
          delete newFilters.errors.maxAmount;
          
          if (prev.minAmount !== null && numValue !== null && numValue < prev.minAmount) {
            newFilters.errors.maxAmount = 'Max amount must be greater than min amount';
            newFilters.isValid = false;
          }
        }
      }

      newFilters.isValid = Object.keys(newFilters.errors).length === 0;
      
      return newFilters;
    });
  }, []);

  // Category change handler
  const handleCategoryChange = useCallback((category: string) => {
    setFilters(prev => ({
      ...prev,
      category: category || null
    }));
  }, []);

  // Search text change handler
  const handleSearchChange = useCallback((text: string) => {
    setFilters(prev => ({
      ...prev,
      searchText: text
    }));
  }, []);

  // Reset filters
  const resetFilters = useCallback(() => {
    setFilters({
      startDate: null,
      endDate: null,
      minAmount: null,
      maxAmount: null,
      category: null,
      searchText: '',
      isValid: true,
      errors: {}
    });
  }, []);

  // Effect to trigger filter changes
  useEffect(() => {
    if (filters.isValid) {
      return debouncedFilterChange(filters);
    } else if (onError) {
      onError('Please correct filter errors');
    }
  }, [filters, debouncedFilterChange, onError]);

  return (
    <View style={styles.container} accessibilityRole="group" accessibilityLabel="Transaction filters">
      <View style={styles.row}>
        <View style={styles.column}>
          <Text style={styles.label}>Start Date</Text>
          <DatePicker
            value={filters.startDate || new Date()}
            onChange={(_, date) => handleDateChange('start', date)}
            disabled={isLoading}
            accessibilityLabel="Select start date"
          />
          {filters.errors.startDate && (
            <Text style={styles.error}>{filters.errors.startDate}</Text>
          )}
        </View>
        <View style={styles.column}>
          <Text style={styles.label}>End Date</Text>
          <DatePicker
            value={filters.endDate || new Date()}
            onChange={(_, date) => handleDateChange('end', date)}
            disabled={isLoading}
            accessibilityLabel="Select end date"
          />
          {filters.errors.endDate && (
            <Text style={styles.error}>{filters.errors.endDate}</Text>
          )}
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.column}>
          <Input
            value={filters.minAmount?.toString() || ''}
            onChangeText={(value) => handleAmountChange('min', value)}
            placeholder="Min amount"
            keyboardType="numeric"
            error={filters.errors.minAmount}
            disabled={isLoading}
            accessibilityLabel="Minimum amount filter"
          />
        </View>
        <View style={styles.column}>
          <Input
            value={filters.maxAmount?.toString() || ''}
            onChangeText={(value) => handleAmountChange('max', value)}
            placeholder="Max amount"
            keyboardType="numeric"
            error={filters.errors.maxAmount}
            disabled={isLoading}
            accessibilityLabel="Maximum amount filter"
          />
        </View>
      </View>

      <View style={styles.row}>
        <Input
          value={filters.category || ''}
          onChangeText={handleCategoryChange}
          placeholder="Select category"
          disabled={isLoading}
          accessibilityLabel="Category filter"
        />
      </View>

      <View style={styles.row}>
        <Input
          value={filters.searchText}
          onChangeText={handleSearchChange}
          placeholder="Search transactions"
          disabled={isLoading}
          accessibilityLabel="Search transactions"
        />
      </View>

      <TouchableOpacity
        onPress={resetFilters}
        disabled={isLoading}
        style={styles.resetButton}
        accessibilityRole="button"
        accessibilityLabel="Reset filters"
      >
        <Text style={styles.resetButtonText}>Reset Filters</Text>
      </TouchableOpacity>
    </View>
  );
});

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    marginHorizontal: theme.spacing.xs,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    marginBottom: theme.spacing.xs,
    color: theme.colors.text.primary,
  },
  error: {
    color: theme.colors.status.error,
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.xs,
  },
  resetButton: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: 4,
    alignItems: 'center',
  },
  resetButtonText: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
});

TransactionFilters.displayName = 'TransactionFilters';

export default TransactionFilters;