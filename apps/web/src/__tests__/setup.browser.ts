/**
 * Vitest setup file for browser environment (Tier 2 tests)
 *
 * Configures:
 * - Testing Library matchers (jest-dom)
 * - CSS imports for real styling
 * - Cleanup after each test
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Import global CSS so Tailwind styles are available
import '../index.css';

// Clean up after each test
afterEach(() => {
  cleanup();
});
