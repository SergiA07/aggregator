/**
 * useFormatters Hook
 *
 * Provides locale-aware formatting functions.
 * Uses the current locale from i18n context.
 *
 * @example
 * const { formatCurrency, formatDate, formatNumber, formatPercent } = useFormatters();
 *
 * // All formats respect the user's locale setting
 * formatCurrency(1234.56) // "$1,234.56" in en, "1.234,56 $" in es
 * formatDate(new Date()) // "Dec 30, 2025" in en, "30 dic 2025" in es
 */

import { useMemo } from 'react';
import { useLocale } from '@/lib/i18n';
import {
  formatCurrency as formatCurrencyFn,
  formatDate as formatDateFn,
  formatNumber as formatNumberFn,
  formatPercent as formatPercentFn,
} from '@/utils/formatters';

export function useFormatters() {
  const { locale } = useLocale();

  return useMemo(
    () => ({
      /**
       * Format a number as currency
       */
      formatCurrency: (value: number | undefined | null, currency = 'EUR') =>
        formatCurrencyFn(value, currency, locale),

      /**
       * Format a number with locale-specific separators
       */
      formatNumber: (value: number | undefined | null, decimals = 2) =>
        formatNumberFn(value, decimals, locale),

      /**
       * Format a number as percentage with sign
       */
      formatPercent: (value: number | undefined | null) => formatPercentFn(value, locale),

      /**
       * Format a date for display
       */
      formatDate: (
        dateStr: string | Date,
        options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
      ) => formatDateFn(dateStr, options, locale),

      /**
       * Current locale for custom formatting needs
       */
      locale,
    }),
    [locale],
  );
}
