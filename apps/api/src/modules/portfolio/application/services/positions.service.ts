import { Inject, Injectable } from '@nestjs/common';
import {
  aggregatePositionTotals,
  convertPositionToEur,
  type PositionEur,
  type PositionTotalsEur,
} from '@/shared/utils';
import {
  type IPositionRepository,
  POSITION_REPOSITORY,
  type PositionWithRelations,
} from '../../infrastructure/repositories';
import { YahooFinanceService } from '../../infrastructure/services';

/**
 * Serialized position with all Decimal fields converted to numbers
 * and EUR-converted values for consistent aggregation
 */
export interface PositionSerialized extends PositionEur {
  id: string;
  userId: string;
  accountId: string;
  securityId: string;
  updatedAt: Date;
  // Relations
  account?: { id: string; institution: string; name: string };
  security?: { id: string; symbol: string; name: string; isin?: string | null };
}

@Injectable()
export class PositionsService {
  constructor(
    @Inject(POSITION_REPOSITORY)
    private readonly positionRepository: IPositionRepository,
    @Inject(YahooFinanceService)
    private readonly yahooFinance: YahooFinanceService,
  ) {}

  /**
   * Get all positions for a user with EUR-converted values
   */
  async findByUser(userId: string): Promise<PositionSerialized[]> {
    const positions = await this.positionRepository.findByUser(userId);
    return this.addEurValues(positions);
  }

  /**
   * Get positions for a specific account with EUR-converted values
   */
  async findByAccount(userId: string, accountId: string): Promise<PositionSerialized[]> {
    const positions = await this.positionRepository.findByAccount(userId, accountId);
    return this.addEurValues(positions);
  }

  /**
   * Get portfolio summary with EUR-converted totals
   */
  async getSummary(userId: string): Promise<PositionTotalsEur> {
    const positions = await this.positionRepository.findByUser(userId);
    const positionsWithEur = await this.addEurValues(positions);
    return aggregatePositionTotals(positionsWithEur);
  }

  /**
   * Add EUR-converted values to positions and convert Decimal to number
   */
  private async addEurValues(positions: PositionWithRelations[]): Promise<PositionSerialized[]> {
    if (positions.length === 0) return [];

    // Collect all currencies and fetch FX rates
    const currencies = [...new Set(positions.map((p) => p.currency))];
    const fxRates = await this.yahooFinance.getFxRatesToEur(currencies);

    // Convert positions using shared utilities
    return positions.map((pos) => ({
      ...pos,
      ...convertPositionToEur(pos, fxRates),
    }));
  }
}
