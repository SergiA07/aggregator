import { Injectable } from '@nestjs/common';
import type { Account } from '@repo/database';
import type { DatabaseService } from '../../../../shared/database';
import type {
  CreateAccountData,
  IAccountRepository,
  UpdateAccountData,
} from './account.repository.interface';

@Injectable()
export class AccountRepository implements IAccountRepository {
  constructor(private readonly db: DatabaseService) {}

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

  async findByBroker(userId: string, broker: string): Promise<Account | null> {
    return this.db.account.findFirst({
      where: { userId, broker },
    });
  }

  async create(userId: string, data: CreateAccountData): Promise<Account> {
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

  async update(id: string, data: UpdateAccountData): Promise<Account> {
    return this.db.account.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.account.delete({
      where: { id },
    });
  }
}
