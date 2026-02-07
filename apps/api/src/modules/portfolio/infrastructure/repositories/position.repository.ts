import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '@/shared/database';
import { decimalToNumberOrZero } from '@/shared/utils';
import type {
  IPositionRepository,
  PositionSummaryStats,
  PositionWithRelations,
} from './position.repository.interface';

@Injectable()
export class PositionRepository implements IPositionRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async findByUser(userId: string): Promise<PositionWithRelations[]> {
    return this.db.position.findMany({
      where: { userId },
      include: {
        account: { select: { id: true, institution: true, name: true } },
        security: { select: { id: true, symbol: true, name: true } },
      },
      orderBy: { marketValue: 'desc' },
    });
  }

  async findByAccount(userId: string, accountId: string): Promise<PositionWithRelations[]> {
    return this.db.position.findMany({
      where: { userId, accountId },
      include: {
        security: { select: { id: true, symbol: true, name: true } },
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
      totalValue: decimalToNumberOrZero(result._sum.marketValue),
      totalCost: decimalToNumberOrZero(result._sum.totalCost),
      totalPnl: decimalToNumberOrZero(result._sum.unrealizedPnl),
      positionCount: result._count,
    };
  }
}
