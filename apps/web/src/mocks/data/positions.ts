/**
 * Mock data for positions
 */
import type { Position, PositionsSummary } from '@repo/shared-types';
import { mockAccounts } from './accounts';
import { mockSecurities } from './securities';

export const mockPositions: Position[] = [
  {
    id: 'pos-1',
    userId: 'user-1',
    accountId: 'acc-1',
    securityId: 'sec-1',
    quantity: 10,
    avgCost: 150.0,
    totalCost: 1500.0,
    marketPrice: 175.0,
    marketValue: 1750.0,
    unrealizedPnl: 250.0,
    currency: 'USD',
    updatedAt: '2024-03-01T00:00:00Z',
    account: mockAccounts[0],
    security: mockSecurities[0],
  },
  {
    id: 'pos-2',
    userId: 'user-1',
    accountId: 'acc-1',
    securityId: 'sec-2',
    quantity: 5,
    avgCost: 320.0,
    totalCost: 1600.0,
    marketPrice: 380.0,
    marketValue: 1900.0,
    unrealizedPnl: 300.0,
    currency: 'USD',
    updatedAt: '2024-03-01T00:00:00Z',
    account: mockAccounts[0],
    security: mockSecurities[1],
  },
  {
    id: 'pos-3',
    userId: 'user-1',
    accountId: 'acc-2',
    securityId: 'sec-3',
    quantity: 20,
    avgCost: 95.0,
    totalCost: 1900.0,
    marketPrice: 102.0,
    marketValue: 2040.0,
    unrealizedPnl: 140.0,
    currency: 'EUR',
    updatedAt: '2024-03-01T00:00:00Z',
    account: mockAccounts[1],
    security: mockSecurities[2],
  },
];

export const mockPositionsSummary: PositionsSummary = {
  totalValue: 5690.0,
  totalCost: 5000.0,
  totalPnl: 690.0,
  pnlPercentage: 13.8,
  positionCount: 3,
};
