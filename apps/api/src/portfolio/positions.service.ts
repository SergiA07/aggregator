import { Injectable, Inject } from '@nestjs/common';
import { DatabaseService } from '../database';
import type { Position } from '@repo/database';

@Injectable()
export class PositionsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async findByUser(userId: string): Promise<Position[]> {
    return this.db.position.findMany({
      where: { userId },
      include: {
        account: true,
        security: true,
      },
      orderBy: { marketValue: 'desc' },
    });
  }

  async findByAccount(userId: string, accountId: string): Promise<Position[]> {
    return this.db.position.findMany({
      where: { userId, accountId },
      include: {
        security: true,
      },
      orderBy: { marketValue: 'desc' },
    });
  }

  async getSummary(userId: string) {
    const positions = await this.findByUser(userId);

    const totalValue = positions.reduce(
      (sum, p) => sum + (p.marketValue?.toNumber() ?? 0),
      0,
    );
    const totalCost = positions.reduce(
      (sum, p) => sum + p.totalCost.toNumber(),
      0,
    );
    const totalPnl = positions.reduce(
      (sum, p) => sum + (p.unrealizedPnl?.toNumber() ?? 0),
      0,
    );

    return {
      totalValue,
      totalCost,
      totalPnl,
      pnlPercentage: totalCost > 0 ? (totalPnl / totalCost) * 100 : 0,
      positionCount: positions.length,
    };
  }
}
