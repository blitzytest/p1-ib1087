/**
 * Utility functions for formatting various data types with internationalization support.
 * Provides consistent formatting for currency, dates, percentages and numbers across the UI.
 * Uses memoized Intl formatters for optimal performance.
 * @version 1.0.0
 */

// Memoized formatters for better performance
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
});

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

/**
 * Formats a number as USD currency with proper thousands separators and 2 decimal places.
 * @param amount - The monetary amount to format
 * @returns Formatted currency string with $ symbol (e.g. '$1,234.56')
 */
export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return '—';
  }
  return currencyFormatter.format(amount);
};

/**
 * Formats a Date object into a readable string with timezone support.
 * @param date - The Date object to format
 * @param timezone - Optional timezone identifier (e.g. 'America/New_York')
 * @returns Formatted date string (e.g. 'Jan 15, 2024')
 */
export const formatDate = (date: Date | null | undefined, timezone?: string): string => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '—';
  }

  try {
    if (timezone) {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: timezone
      }).format(date);
    }
    return dateFormatter.format(date);
  } catch (error) {
    console.error('Date formatting error:', error);
    return dateFormatter.format(date);
  }
};

/**
 * Formats a decimal number as a percentage with sign indicator and configurable precision.
 * @param value - The decimal value to format as percentage (e.g. 0.0825 for 8.25%)
 * @param decimalPlaces - Number of decimal places (default: 2)
 * @returns Formatted percentage string with sign (e.g. '+8.25%')
 */
export const formatPercentage = (
  value: number | null | undefined,
  decimalPlaces: number = 2
): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  const percentValue = value * 100;
  const sign = percentValue > 0 ? '+' : '';
  
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  });

  return `${sign}${formatter.format(percentValue)}%`;
};

/**
 * Formats a number with thousands separators and configurable decimal places.
 * @param value - The number to format
 * @param decimalPlaces - Number of decimal places (default: 2)
 * @returns Formatted number string with proper separators (e.g. '1,234.56')
 */
export const formatNumber = (
  value: number | null | undefined,
  decimalPlaces: number = 2
): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  });

  return formatter.format(value);
};