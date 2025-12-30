/**
 * i18n Translation Engine
 *
 * This file contains the runtime logic for:
 * 1. Looking up translations by key
 * 2. Performing parameter substitutions
 * 3. Formatting values using Intl APIs
 * 4. Handling fallback locales
 */

import type {
  EnumOptions,
  I18nMessages,
  MessageOptions,
  PluralOptions,
  SupportedLocale,
} from './types';

// =============================================================================
// LOCALE FALLBACK CHAIN
// =============================================================================

/**
 * Builds an ordered list of locales to check, from most specific to least.
 *
 * Example: getLocaleChain('en-US') returns ['en-US', 'en']
 * This allows en-US to fall back to generic en translations.
 */
export function getLocaleChain(locale: string): string[] {
  const chain: string[] = [];
  let current = locale;

  while (current) {
    chain.push(current);
    // Remove the last segment (e.g., 'en-US' -> 'en')
    const lastDash = current.lastIndexOf('-');
    current = lastDash > 0 ? current.slice(0, lastDash) : '';
  }

  return chain;
}

/**
 * Builds the complete locale fallback order including fallback locales.
 */
export function buildLocaleOrder(
  locale: SupportedLocale,
  fallbackLocale: SupportedLocale | SupportedLocale[],
): string[] {
  const fallbacks = Array.isArray(fallbackLocale) ? fallbackLocale : [fallbackLocale];
  const seen = new Set<string>();
  const order: string[] = [];

  // First, add the current locale and its parents
  for (const loc of getLocaleChain(locale)) {
    if (!seen.has(loc)) {
      seen.add(loc);
      order.push(loc);
    }
  }

  // Then add fallback locales and their parents
  for (const fallback of fallbacks) {
    for (const loc of getLocaleChain(fallback)) {
      if (!seen.has(loc)) {
        seen.add(loc);
        order.push(loc);
      }
    }
  }

  return order;
}

// =============================================================================
// MESSAGE LOOKUP
// =============================================================================

/**
 * Gets a message by dot-notation path from a messages object.
 *
 * Example: getMessageByPath(messages, 'auth.login.title')
 */
export function getMessageByPath(
  messages: I18nMessages,
  path: string,
): string | readonly [string, MessageOptions] | undefined {
  const keys = path.split('.');
  let current: unknown = messages;

  for (const key of keys) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  // Must be a string or tuple, not nested messages
  if (typeof current === 'string') {
    return current;
  }
  if (Array.isArray(current) && current.length >= 2 && typeof current[0] === 'string') {
    return current as unknown as readonly [string, MessageOptions];
  }

  return undefined;
}

// =============================================================================
// PARAMETER SUBSTITUTION
// =============================================================================

/**
 * Pattern to match parameters in translation strings.
 * Matches: {name} or {name:type}
 */
const PARAM_REGEX = /\{(\w+)(?::(\w+))?\}/g;

/**
 * Performs parameter substitution on a translation string.
 *
 * @param locale - Current locale for formatting
 * @param template - The translation string with {param} placeholders
 * @param params - The parameter values
 * @param options - Formatting options for typed parameters
 */
export function substitute(
  locale: string,
  template: string,
  params: Record<string, unknown>,
  options: MessageOptions = {},
): string {
  return template.replace(PARAM_REGEX, (match, name: string, type?: string) => {
    const value = params[name];

    if (value === undefined) {
      console.warn(`Missing i18n parameter: ${name}`);
      return match; // Keep placeholder if value missing
    }

    const paramOptions = options[name];

    // No type specified - just convert to string
    if (!type) {
      return String(value);
    }

    // Handle each parameter type using Intl APIs
    switch (type) {
      case 'number':
        return formatNumber(locale, value as number, paramOptions as Intl.NumberFormatOptions);

      case 'date':
        return formatDate(locale, value as Date, paramOptions as Intl.DateTimeFormatOptions);

      case 'plural':
        return formatPlural(locale, value as number, paramOptions as PluralOptions);

      case 'list':
        return formatList(locale, value as string[], paramOptions as Intl.ListFormatOptions);

      case 'enum':
        return formatEnum(value as string, paramOptions as EnumOptions);

      default:
        return String(value);
    }
  });
}

// =============================================================================
// FORMATTING FUNCTIONS (using native Intl APIs)
// =============================================================================

/**
 * Formats a number using Intl.NumberFormat.
 * Supports currency, percentages, units, etc.
 */
function formatNumber(locale: string, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Formats a date using Intl.DateTimeFormat.
 * Supports various date/time styles and patterns.
 */
function formatDate(locale: string, value: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options).format(value);
}

/**
 * Formats a number using plural rules.
 *
 * Example:
 *   formatPlural('en', 1, { one: '1 message', other: '{?} messages' })
 *   -> '1 message'
 *
 *   formatPlural('en', 5, { one: '1 message', other: '{?} messages' })
 *   -> '5 messages'
 *
 * The {?} placeholder is replaced with the number.
 */
function formatPlural(locale: string, value: number, options?: PluralOptions): string {
  if (!options) {
    return String(value);
  }

  const pluralRules = new Intl.PluralRules(locale, { type: options.type ?? 'cardinal' });
  const rule = pluralRules.select(value) as keyof PluralOptions;

  // Get the template for this plural form, falling back to 'other'
  const template = options[rule] ?? options.other;

  // Replace {?} with the formatted number
  return template.replace(/\{\?\}/g, new Intl.NumberFormat(locale).format(value));
}

/**
 * Formats a list using Intl.ListFormat.
 *
 * Example: ['apples', 'oranges', 'bananas'] -> 'apples, oranges, and bananas'
 */
function formatList(locale: string, value: string[], options?: Intl.ListFormatOptions): string {
  return new Intl.ListFormat(locale, {
    style: 'long',
    type: 'conjunction',
    ...options,
  }).format(value);
}

/**
 * Maps an enum value to its translated string.
 */
function formatEnum(value: string, options?: EnumOptions): string {
  if (!options || !(value in options)) {
    console.warn(`Missing enum translation for: ${value}`);
    return value;
  }
  return options[value];
}

// =============================================================================
// MAIN TRANSLATION FUNCTION FACTORY
// =============================================================================

export interface TranslateOptions {
  locale: SupportedLocale;
  fallbackLocale: SupportedLocale | SupportedLocale[];
  messages: Record<string, I18nMessages>;
}

/**
 * Creates the main translation function `t()`.
 *
 * This function handles:
 * 1. Looking up the translation in the locale chain
 * 2. Falling back through locales if not found
 * 3. Performing parameter substitution
 */
export function createTranslator(options: TranslateOptions) {
  const { locale, fallbackLocale, messages } = options;
  const localeOrder = buildLocaleOrder(locale, fallbackLocale);

  /**
   * The translation function.
   *
   * @param key - Dot-notation path to the translation
   * @param params - Parameters to substitute (optional)
   * @returns The translated string
   */
  function t(key: string, params?: Record<string, unknown>): string {
    // Try each locale in order until we find a translation
    for (const loc of localeOrder) {
      const localeMessages = messages[loc];
      if (!localeMessages) continue;

      const message = getMessageByPath(localeMessages, key);
      if (message === undefined) continue;

      // Found the translation - perform substitution
      if (typeof message === 'string') {
        return params ? substitute(loc, message, params) : message;
      }

      // Tuple form: [template, options]
      const [template, messageOptions] = message;
      return substitute(loc, template, params ?? {}, messageOptions);
    }

    // No translation found - return the key as fallback
    console.warn(`Missing translation: ${key}`);
    return key;
  }

  return t;
}
