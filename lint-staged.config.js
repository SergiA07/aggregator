/**
 * @type {import('lint-staged').Config}
 */
export default {
  // Lint and format JS/TS files
  '*.{js,ts,tsx}': ['bunx biome check --write --no-errors-on-unmatched'],

  // Format-only for JSON and Markdown
  '*.{json,md}': ['bunx biome format --write --no-errors-on-unmatched'],
};
