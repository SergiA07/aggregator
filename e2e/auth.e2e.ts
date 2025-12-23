import { expect, test } from '@playwright/test';

/**
 * Authentication E2E Tests
 *
 * Tests the login flow and protected route access.
 * Uses role-based and label locators per Playwright best practices.
 *
 * @see https://playwright.dev/docs/best-practices
 */
test.describe('Authentication', () => {
  // Note: This test is skipped because dev server runs with VITE_DEV_MODE=true
  // which bypasses auth. In CI, run against production build to test auth redirect.
  test.skip('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login page
    await expect(page).toHaveURL(/login/);
  });

  test('displays login form with all required fields', async ({ page }) => {
    await page.goto('/login');

    // Form elements should be visible using accessibility locators
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill form using label locators
    await page.getByLabel('Email').fill('invalid@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Error message should appear
    await expect(page.getByText(/error|invalid|failed/i)).toBeVisible();
  });

  test('toggles between sign in and sign up modes', async ({ page }) => {
    await page.goto('/login');

    // Initially in sign in mode
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

    // Switch to sign up
    await page.getByRole('button', { name: /don't have an account/i }).click();
    await expect(page.getByRole('button', { name: 'Sign Up' })).toBeVisible();

    // Switch back to sign in
    await page.getByRole('button', { name: /already have an account/i }).click();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });
});
