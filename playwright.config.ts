import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * Full-stack tests that verify complete user journeys.
 * Tests are located in /e2e directory at monorepo root.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: './e2e/test-results',

  // Run all tests in parallel for speed
  fullyParallel: true,

  // Fail CI if test.only is accidentally left in code
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit workers on CI to avoid resource issues
  workers: process.env.CI ? 1 : undefined,

  // HTML reporter for local viewing, list for CI output
  reporter: process.env.CI
    ? 'list'
    : [['html', { open: 'never', outputFolder: './e2e/playwright-report' }]],

  // Shared settings for all projects
  use: {
    baseURL: 'http://localhost:5173',

    // Collect trace on first retry for debugging CI failures
    trace: 'on-first-retry',

    // Screenshot only on failure to save storage
    screenshot: 'only-on-failure',
  },

  // Browser projects
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start web dev server before tests
  webServer: {
    command: 'bun run dev:web',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
