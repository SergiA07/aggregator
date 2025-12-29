import { Inject, Injectable } from '@nestjs/common';
import {
  type IPositionRepository,
  POSITION_REPOSITORY,
  type PositionWithRelations,
} from '../../infrastructure/repositories';

@Injectable()
export class PositionsService {
  constructor(
    @Inject(POSITION_REPOSITORY)
    private readonly positionRepository: IPositionRepository,
  ) {}

  async findByUser(userId: string): Promise<PositionWithRelations[]> {
    return this.positionRepository.findByUser(userId);
  }

  async findByAccount(userId: string, accountId: string): Promise<PositionWithRelations[]> {
    return this.positionRepository.findByAccount(userId, accountId);
  }

  async getSummary(userId: string) {
    const stats = await this.positionRepository.getSummaryStats(userId);

    return {
      ...stats,
      pnlPercentage: stats.totalCost > 0 ? (stats.totalPnl / stats.totalCost) * 100 : 0,
    };
  }
}
