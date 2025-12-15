import { Injectable, Inject } from '@nestjs/common';
import { DatabaseService } from '../database';
import type { Account } from '@repo/database';

@Injectable()
export class AccountsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async findByUser(userId: string): Promise<Account[]> {
    return this.db.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string): Promise<Account | null> {
    return this.db.account.findFirst({
      where: { id, userId },
    });
  }

  async create(
    userId: string,
    data: { broker: string; accountId: string; accountName?: string; currency?: string },
  ): Promise<Account> {
    return this.db.account.create({
      data: {
        userId,
        broker: data.broker,
        accountId: data.accountId,
        accountName: data.accountName,
        currency: data.currency ?? 'EUR',
      },
    });
  }

  async update(
    userId: string,
    id: string,
    data: { accountName?: string; currency?: string },
  ): Promise<Account> {
    return this.db.account.update({
      where: { id },
      data: {
        accountName: data.accountName,
        currency: data.currency,
      },
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.db.account.delete({
      where: { id },
    });
  }
}
