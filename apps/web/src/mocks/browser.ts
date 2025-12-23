/**
 * MSW Browser Worker for:
 * - Vitest Browser Mode tests (Tier 2)
 * - Development mode with mocked API (dev:mock)
 *
 * This service worker runs in the browser and intercepts fetch requests.
 */
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
