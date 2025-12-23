/**
 * Vitest setup file for jsdom environment (Tier 1 tests)
 *
 * Configures:
 * - Testing Library matchers (jest-dom)
 * - MSW server for API mocking
 * - Cleanup after each test
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '@/mocks/node';

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Clean up after each test
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Close MSW server after all tests
afterAll(() => server.close());
