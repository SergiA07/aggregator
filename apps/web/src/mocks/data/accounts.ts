/**
 * Mock data for accounts
 */
import type { Account } from '@repo/shared-types';

export const mockAccounts: Account[] = [
  {
    id: 'acc-1',
    userId: 'user-1',
    broker: 'degiro',
    accountId: 'DEGIRO-001',
    accountName: 'Main Investment',
    currency: 'EUR',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'acc-2',
    userId: 'user-1',
    broker: 'interactive-brokers',
    accountId: 'IBKR-001',
    accountName: 'US Stocks',
    currency: 'USD',
    createdAt: '2024-02-15T00:00:00Z',
    updatedAt: '2024-02-15T00:00:00Z',
  },
];
