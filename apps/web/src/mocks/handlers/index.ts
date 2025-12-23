/**
 * MSW handlers - combines all domain handlers
 *
 * This file aggregates all handlers and exports them for use in:
 * - Vitest (jsdom) via node.ts
 * - Vitest Browser Mode via browser.ts
 * - Development mode via main.tsx (dev:mock)
 */
import { HttpResponse, http } from 'msw';
import { mockHealth } from '../data/health';
import { accountHandlers } from './accounts';
import { importHandlers } from './import';
import { positionHandlers } from './positions';
import { securityHandlers } from './securities';
import { transactionHandlers } from './transactions';

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000';

// Health check handler
const healthHandlers = [
  http.get(`${API_URL}/health`, () => {
    return HttpResponse.json(mockHealth);
  }),
];

// Combine all handlers
export const handlers = [
  ...healthHandlers,
  ...accountHandlers,
  ...positionHandlers,
  ...transactionHandlers,
  ...securityHandlers,
  ...importHandlers,
];

// Re-export individual handler groups for selective use in tests
export {
  accountHandlers,
  healthHandlers,
  importHandlers,
  positionHandlers,
  securityHandlers,
  transactionHandlers,
};
