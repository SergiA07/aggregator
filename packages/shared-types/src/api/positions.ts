/**
 * Position types - matches Prisma Position model
 */
import type { Account } from './accounts';
import type { Security } from './securities';

export interface Position {
  id: string;
  userId: string;
  accountId: string;
  securityId: string;
  quantity: number;
  avgCost: number;
  totalCost: number;
  marketPrice?: number | null;
  marketValue?: number | null;
  unrealizedPnl?: number | null;
  currency: string;
  updatedAt: string;
  // Populated relations (optional)
  account?: Account;
  security?: Security;
}

export interface PositionsSummary {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  pnlPercentage: number;
  positionCount: number;
}
