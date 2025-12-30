/**
 * Core i18n Type System
 *
 * This file contains all the TypeScript magic that makes our i18n fully type-safe.
 * The key insight is that we parse the translation strings at the TYPE level to
 * extract parameter information and enforce correct usage.
 */

// =============================================================================
// BASIC TYPES
// =============================================================================

/**
 * A translation message can be:
 * - A simple string: "Hello"
 * - A string with parameters: "Hello {name}"
 * - A tuple with string + options: ["You have {count:plural} messages", { count: { one: "message", other: "messages" } }]
 * - Nested messages for organization
 */
export type I18nMessage = string | readonly [string, MessageOptions] | I18nMessages;

export type I18nMessages = {
  readonly [key: string]: I18nMessage;
};

/**
 * Options passed when defining a translation with parameters.
 * Each parameter type (plural, date, number, enum, list) has specific options.
 */
export type MessageOptions = {
  readonly [key: string]:
    | PluralOptions
    | Intl.DateTimeFormatOptions
    | Intl.NumberFormatOptions
    | Intl.ListFormatOptions
    | EnumOptions;
};

/**
 * Plural options follow LDML plural rules.
 * "other" is required as the fallback, rest are optional based on language.
 */
export type PluralOptions = {
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string; // Required fallback
  readonly type?: Intl.PluralRulesOptions['type']; // 'cardinal' | 'ordinal'
};

/**
 * Enum options map enum values to their translated strings.
 * e.g., { developer: "Software Developer", designer: "UI Designer" }
 */
export type EnumOptions = {
  readonly [enumValue: string]: string;
};

// =============================================================================
// TYPE-LEVEL STRING PARSING
// =============================================================================

/**
 * Supported parameter types in translation strings.
 * Usage: "Hello {name}" or "Date: {date:date}" or "Count: {count:plural}"
 */
type ParamType = 'string' | 'number' | 'date' | 'plural' | 'list' | 'enum';

/**
 * Maps parameter types to their expected runtime values.
 */
type ParamTypeToValue<T extends ParamType> = T extends 'string'
  ? string
  : T extends 'number' | 'plural'
    ? number
    : T extends 'date'
      ? Date
      : T extends 'list'
        ? string[]
        : T extends 'enum'
          ? string
          : never;

/**
 * Extracts parameters from a translation string at the TYPE level.
 *
 * Example: "Hello {name}, you have {count:plural} messages"
 * Returns: { name: string; count: number }
 *
 * This is the core "magic" - we use template literal types to parse the string.
 */
export type ExtractParams<S extends string> =
  // Match pattern: ...{param}... or ...{param:type}...
  S extends `${string}{${infer Param}}${infer Rest}`
    ? Param extends `${infer Name}:${infer Type}`
      ? // Has type annotation: {name:type}
        Type extends ParamType
        ? { [K in Name]: ParamTypeToValue<Type> } & ExtractParams<Rest>
        : ExtractParams<Rest>
      : // No type annotation: {name} defaults to string
        { [K in Param]: string } & ExtractParams<Rest>
    : // No more parameters found - empty object is intentional for type accumulation
      // biome-ignore lint/complexity/noBannedTypes: {} represents "no parameters" in recursive type
      {};

/**
 * Simplifies intersection types for better IDE display.
 * { a: string } & { b: number } becomes { a: string; b: number }
 */
export type Simplify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Checks if an object type is empty (has no keys).
 */
export type IsEmpty<T> = keyof T extends never ? true : false;

// =============================================================================
// PATH-BASED KEY ACCESS
// =============================================================================

/**
 * Generates all valid dot-notation paths for a messages object.
 *
 * Example: { auth: { login: "Login", logout: "Logout" }, greeting: "Hello" }
 * Returns: "auth.login" | "auth.logout" | "greeting"
 */
export type MessagePaths<T, Prefix extends string = ''> = T extends I18nMessages
  ? {
      [K in keyof T & string]: T[K] extends I18nMessages
        ? MessagePaths<T[K], Prefix extends '' ? K : `${Prefix}.${K}`>
        : Prefix extends ''
          ? K
          : `${Prefix}.${K}`;
    }[keyof T & string]
  : never;

/**
 * Gets the message type at a specific dot-notation path.
 */
export type MessageAtPath<T, P extends string> = P extends `${infer Key}.${infer Rest}`
  ? Key extends keyof T
    ? MessageAtPath<T[Key], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/**
 * Extracts the string template from a message (handles both string and tuple forms).
 */
export type GetMessageString<M> = M extends string
  ? M
  : M extends readonly [infer S extends string, unknown]
    ? S
    : never;

/**
 * Gets parameters for a message at a specific path.
 */
export type ParamsAtPath<T, P extends string> = Simplify<
  ExtractParams<GetMessageString<MessageAtPath<T, P>>>
>;

// =============================================================================
// TRANSLATION FUNCTION TYPES
// =============================================================================

/**
 * Paths that require parameters (non-empty params object).
 */
export type PathsWithParams<T> = {
  [P in MessagePaths<T>]: IsEmpty<ParamsAtPath<T, P>> extends true ? never : P;
}[MessagePaths<T>];

/**
 * Paths that don't require parameters.
 */
export type PathsWithoutParams<T> = {
  [P in MessagePaths<T>]: IsEmpty<ParamsAtPath<T, P>> extends true ? P : never;
}[MessagePaths<T>];

// =============================================================================
// DEFINITION-TIME TYPE SAFETY
// =============================================================================

/**
 * Extracts parameter options needed when DEFINING a translation.
 * This is for the second element of the tuple: [string, OPTIONS]
 *
 * Only typed parameters need options:
 * - {name} -> no options needed (plain string)
 * - {count:plural} -> needs PluralOptions
 * - {date:date} -> needs DateTimeFormatOptions
 * - {role:enum} -> needs EnumOptions
 */
export type ExtractDefinitionOptions<S extends string> =
  S extends `${string}{${infer Param}}${infer Rest}`
    ? Param extends `${infer Name}:${infer Type}`
      ? Type extends 'plural'
        ? { [K in Name]: PluralOptions } & ExtractDefinitionOptions<Rest>
        : Type extends 'date'
          ? { [K in Name]?: Intl.DateTimeFormatOptions } & ExtractDefinitionOptions<Rest>
          : Type extends 'number'
            ? { [K in Name]?: Intl.NumberFormatOptions } & ExtractDefinitionOptions<Rest>
            : Type extends 'list'
              ? { [K in Name]?: Intl.ListFormatOptions } & ExtractDefinitionOptions<Rest>
              : Type extends 'enum'
                ? { [K in Name]: EnumOptions } & ExtractDefinitionOptions<Rest>
                : ExtractDefinitionOptions<Rest>
      : ExtractDefinitionOptions<Rest>
    : // biome-ignore lint/complexity/noBannedTypes: {} represents "no options needed" in recursive type
      {};

// =============================================================================
// LOCALE TYPES
// =============================================================================

/**
 * Supported locales. Add more as needed.
 */
export type SupportedLocale = 'en' | 'es' | 'ca' | 'en-US' | 'es-ES' | 'ca-ES';

/**
 * Configuration for initializing the i18n system.
 */
export interface I18nConfig<T extends I18nMessages> {
  locale: SupportedLocale;
  fallbackLocale: SupportedLocale | SupportedLocale[];
  messages: Record<string, T>;
}
