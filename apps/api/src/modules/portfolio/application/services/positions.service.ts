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
    const positions = await this.findByUser(userId);

    const totalValue = positions.reduce((sum, p) => sum + (p.marketValue?.toNumber() ?? 0), 0);
    const totalCost = positions.reduce((sum, p) => sum + p.totalCost.toNumber(), 0);
    const totalPnl = positions.reduce((sum, p) => sum + (p.unrealizedPnl?.toNumber() ?? 0), 0);

    return {
      totalValue,
      totalCost,
      totalPnl,
      pnlPercentage: totalCost > 0 ? (totalPnl / totalCost) * 100 : 0,
      positionCount: positions.length,
    };
  }
}
