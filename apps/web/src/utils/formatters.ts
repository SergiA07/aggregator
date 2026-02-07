/**
 * Formatting utilities using native Intl APIs.
 *
 * All formatters accept an optional locale parameter.
 * When used with useFormatters() hook, locale is automatically injected.
 */

// Default locale for standalone usage
const DEFAULT_LOCALE = 'en';

/**
 * Format a number as currency
 * @param value - Number to format
 * @param currency - Currency code (default: EUR)
 * @param locale - Locale for formatting (default: en)
 */
export function formatCurrency(
  value: number | undefined | null,
  currency = 'EUR',
  locale = DEFAULT_LOCALE,
): string {
  if (value === undefined || value === null) return '-';
  return new Intl.NumberFormat(locale, {
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
 * @param locale - Locale for formatting (default: en)
 */
export function formatNumber(
  value: number | undefined | null,
  decimals = 2,
  locale = DEFAULT_LOCALE,
): string {
  if (value === undefined || value === null) return '-';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a number as percentage with sign
 * @param value - Percentage value (e.g., 5.25 for 5.25%)
 * @param locale - Locale for formatting (default: en)
 */
export function formatPercent(value: number | undefined | null, locale = DEFAULT_LOCALE): string {
  if (value === undefined || value === null) return '-';
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(value / 100); // Intl.NumberFormat expects 0.05 for 5%
}

/**
 * Format a date for display using Intl.DateTimeFormat
 * @param dateStr - ISO date string or Date object
 * @param options - Intl.DateTimeFormatOptions (default: medium date style)
 * @param locale - Locale for formatting (default: en)
 */
export function formatDate(
  dateStr: string | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  locale = DEFAULT_LOCALE,
): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * Format a date as relative time (e.g., "2 hours ago", "yesterday")
 * @param date - Date to format
 * @param locale - Locale for formatting (default: en)
 */
export function formatRelativeDate(date: Date, locale = DEFAULT_LOCALE): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffDays > 30) {
    return formatDate(date, { dateStyle: 'medium' }, locale);
  }
  if (diffDays >= 1) {
    return rtf.format(-diffDays, 'day');
  }
  if (diffHours >= 1) {
    return rtf.format(-diffHours, 'hour');
  }
  if (diffMins >= 1) {
    return rtf.format(-diffMins, 'minute');
  }
  return rtf.format(-diffSecs, 'second');
}
