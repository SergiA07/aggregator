import type { Position } from '@repo/database';

// DI token for NestJS
export const POSITION_REPOSITORY = 'POSITION_REPOSITORY';

// Position with relations for API responses
export interface PositionWithRelations extends Position {
  account?: { id: string; institution: string; name: string };
  security?: { id: string; symbol: string; name: string };
}

// Summary stats calculated via database aggregation
export interface PositionSummaryStats {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  positionCount: number;
}

// Repository interface
export interface IPositionRepository {
  findByUser(userId: string): Promise<PositionWithRelations[]>;
  findByAccount(userId: string, accountId: string): Promise<PositionWithRelations[]>;
  getSummaryStats(userId: string): Promise<PositionSummaryStats>;
}
