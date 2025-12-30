/**
 * Translation Definition Helper
 *
 * The `dt()` function provides type safety when DEFINING translations.
 * It ensures that the options you provide match the parameters in your string.
 *
 * Without dt(): No type checking on options
 *   ["You have {count:plural} messages", { count: { one: "message", other: "messages" } }]
 *
 * With dt(): Full autocomplete and type checking
 *   dt("You have {count:plural} messages", { count: { one: "message", other: "messages" } })
 */

import type { ExtractDefinitionOptions, Simplify } from './types';

/**
 * Define Translation - provides type safety for translation definitions.
 *
 * @param template - The translation string with {param} or {param:type} placeholders
 * @param options - Formatting options for typed parameters
 * @returns A tuple of [template, options] that the engine understands
 *
 * @example
 * // Simple string - no dt() needed
 * greeting: "Hello, world!"
 *
 * @example
 * // String with plain parameters - no dt() needed
 * greetUser: "Hello, {name}!"
 *
 * @example
 * // String with typed parameters - use dt() for type safety
 * messageCount: dt("You have {count:plural} new messages", {
 *   count: {
 *     one: "{?} new message",
 *     other: "{?} new messages"
 *   }
 * })
 *
 * @example
 * // Date formatting
 * lastLogin: dt("Last login: {date:date}", {
 *   date: { dateStyle: "medium", timeStyle: "short" }
 * })
 *
 * @example
 * // Enum mapping
 * roleLabel: dt("Role: {role:enum}", {
 *   role: {
 *     admin: "Administrator",
 *     user: "Standard User",
 *     guest: "Guest"
 *   }
 * })
 */
export function dt<S extends string>(
  template: S,
  options: Simplify<ExtractDefinitionOptions<S>>,
): readonly [S, Simplify<ExtractDefinitionOptions<S>>] {
  return [template, options] as const;
}
