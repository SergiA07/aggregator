/**
 * i18n Library - Custom internationalization for the Portfolio Aggregator
 *
 * Features:
 * - 100% type-safe translation keys and parameters
 * - Native Intl APIs for formatting (numbers, dates, lists, plurals)
 * - Locale fallback chains (e.g., en-US -> en -> fallback)
 * - Minimal bundle size (~2kb)
 * - No Context/Provider needed - uses Zustand directly
 *
 * Usage:
 *
 * 1. Use the useTranslation hook in components:
 *    ```tsx
 *    const { t } = useTranslation();
 *    return <h1>{t('dashboard.title')}</h1>;
 *    ```
 *
 * 2. For keys with parameters:
 *    ```tsx
 *    {t('transactions.count', { count: 5 })}
 *    // -> "5 transactions"
 *    ```
 *
 * Adding translations:
 * - Edit src/lib/i18n/locales/en.ts (base translations)
 * - Mirror changes in src/lib/i18n/locales/es.ts (and other locales)
 * - Use dt() helper for typed parameters (plurals, dates, enums)
 */

// Definition helper (for adding translations)
export { dt } from './define';
export type { TranslationKey } from './react';
// React integration (hooks only, no Provider needed)
export { useLocale, useTranslation } from './react';
// Types (for advanced usage)
export type { I18nMessages, SupportedLocale } from './types';
