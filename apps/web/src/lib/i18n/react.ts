/**
 * React Integration for i18n
 *
 * Simple hooks that use Zustand store directly - no Context needed.
 */

import { usePreferences } from '@/stores/preferences';
import { createTranslator } from './engine';
import { ca } from './locales/ca';
import { en } from './locales/en';
import { es } from './locales/es';
import type {
  I18nMessages,
  MessagePaths,
  ParamsAtPath,
  PathsWithoutParams,
  PathsWithParams,
  Simplify,
} from './types';

// =============================================================================
// MESSAGES REGISTRY
// =============================================================================

const messages: Record<string, I18nMessages> = {
  en,
  es,
  ca,
};

// =============================================================================
// TYPE-SAFE TRANSLATION FUNCTION
// =============================================================================

export interface TypedTranslateFunction<T extends I18nMessages> {
  (key: PathsWithoutParams<T>): string;
  <K extends PathsWithParams<T>>(key: K, params: Simplify<ParamsAtPath<T, K>>): string;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * useTranslation - Access the translation function.
 *
 * Uses Zustand store directly, no Context needed.
 *
 * @example
 * function MyComponent() {
 *   const { t } = useTranslation();
 *   return <h1>{t('dashboard.title')}</h1>;
 * }
 */
export function useTranslation() {
  const locale = usePreferences((state) => state.locale);

  const translator = createTranslator({
    locale,
    fallbackLocale: 'en',
    messages,
  });

  return { t: translator as TypedTranslateFunction<typeof en> };
}

/**
 * useLocale - Access and modify the current locale.
 *
 * @example
 * function LanguagePicker() {
 *   const { locale, setLocale } = useLocale();
 *   return <select value={locale} onChange={(e) => setLocale(e.target.value)} />;
 * }
 */
export function useLocale() {
  const locale = usePreferences((state) => state.locale);
  const setLocale = usePreferences((state) => state.setLocale);

  return { locale, setLocale };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type TranslationKey = MessagePaths<typeof en>;
