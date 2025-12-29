import { Injectable } from '@nestjs/common';
import type { DatabaseService } from '../../../../shared/database';
import type {
  IPositionRepository,
  PositionSummaryStats,
  PositionWithRelations,
} from './position.repository.interface';

@Injectable()
export class PositionRepository implements IPositionRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByUser(userId: string): Promise<PositionWithRelations[]> {
    return this.db.position.findMany({
      where: { userId },
      include: {
        account: true,
        security: true,
      },
      orderBy: { marketValue: 'desc' },
    });
  }

  async findByAccount(userId: string, accountId: string): Promise<PositionWithRelations[]> {
    return this.db.position.findMany({
      where: { userId, accountId },
      include: {
        security: true,
      },
      orderBy: { marketValue: 'desc' },
    });
  }

  async getSummaryStats(userId: string): Promise<PositionSummaryStats> {
    const result = await this.db.position.aggregate({
      where: { userId },
      _sum: {
        marketValue: true,
        totalCost: true,
        unrealizedPnl: true,
      },
      _count: true,
    });

    return {
      totalValue: result._sum.marketValue?.toNumber() ?? 0,
      totalCost: result._sum.totalCost?.toNumber() ?? 0,
      totalPnl: result._sum.unrealizedPnl?.toNumber() ?? 0,
      positionCount: result._count,
    };
  }
}
