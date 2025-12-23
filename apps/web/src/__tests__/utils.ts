/**
 * Test utilities for browser tests
 */

/**
 * Get a Tailwind CSS color variable value, normalized to decimal format.
 *
 * Tailwind v4 CSS variables use percentage format: "oklch(27.9% 0.041 260.031)"
 * But getComputedStyle returns decimal format: "oklch(0.279 0.041 260.031)"
 *
 * @param varName - CSS variable name (e.g., '--color-slate-800')
 * @returns The color value in decimal format for comparison with computed styles
 */
export function getTailwindColor(varName: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName);
  // Convert percentage to decimal: 27.9% -> 0.279
  return value.replace(/(\d+\.?\d*)%/, (_, n) => (n / 100).toFixed(3)).trim();
}
