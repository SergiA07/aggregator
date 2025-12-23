import { format } from 'date-fns';

/**
 * Format a number as currency
 * @param value - Number to format
 * @param currency - Currency code (default: EUR)
 */
export function formatCurrency(value: number | undefined | null, currency = 'EUR'): string {
  if (value === undefined || value === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number with locale-specific separators
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 */
export function formatNumber(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null) return '-';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a number as percentage with sign
 * @param value - Percentage value (e.g., 5.25 for 5.25%)
 */
export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format a date string for display
 * @param dateStr - ISO date string or Date object
 * @param pattern - date-fns format pattern (default: 'MMM d, yyyy')
 */
export function formatDate(dateStr: string | Date, pattern = 'MMM d, yyyy'): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return format(date, pattern);
}
