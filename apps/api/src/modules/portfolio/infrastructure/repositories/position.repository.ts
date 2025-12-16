import { Injectable } from '@nestjs/common';
import type { DatabaseService } from '../../../../shared/database';
import type { IPositionRepository, PositionWithRelations } from './position.repository.interface';

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
}
