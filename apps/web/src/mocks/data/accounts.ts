/**
 * Mock data for accounts
 */
import type { Account } from '@repo/shared-types';

export const mockAccounts: Account[] = [
  {
    id: 'acc-1',
    userId: 'user-1',
    type: 'broker',
    institution: 'degiro',
    name: 'Main Investment',
    externalId: 'DEGIRO-001',
    baseCurrency: 'EUR',
    isActive: true,
    lastImportAt: '2024-01-01T00:00:00Z',
    notes: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'acc-2',
    userId: 'user-1',
    type: 'broker',
    institution: 'interactive-brokers',
    name: 'US Stocks',
    externalId: 'IBKR-001',
    baseCurrency: 'USD',
    isActive: true,
    lastImportAt: '2024-02-15T00:00:00Z',
    notes: null,
    createdAt: '2024-02-15T00:00:00Z',
    updatedAt: '2024-02-15T00:00:00Z',
  },
];
