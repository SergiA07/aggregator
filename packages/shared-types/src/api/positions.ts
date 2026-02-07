/**
 * Position types - matches Prisma Position model
 */
import type { Account } from './accounts';
import type { Security } from './securities';

/**
 * Price source identifier for tracking which API provided the data
 */
export type PriceSource = 'finnhub' | 'yahoo' | 'justetf' | 'cached';

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
  // EUR-converted values for consistent aggregation
  marketValueEur?: number | null;
  unrealizedPnlEur?: number | null;
  totalCostEur?: number | null;
  /** P&L percentage: (unrealizedPnl / totalCost) * 100, calculated on backend for consistency */
  unrealizedPnlPercent?: number;
  /** Source of the price data (e.g., 'finnhub', 'yahoo', 'justetf', 'cached') */
  source?: PriceSource;
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
