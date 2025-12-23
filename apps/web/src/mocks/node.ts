/**
 * MSW Node Server for Vitest (jsdom environment)
 *
 * This server runs in Node.js and intercepts HTTP requests during tests.
 * Used by: Vitest unit/integration tests (Tier 1)
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
