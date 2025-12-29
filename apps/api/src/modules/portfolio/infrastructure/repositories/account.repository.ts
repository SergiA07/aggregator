import { Inject, Injectable } from '@nestjs/common';
import type { Account } from '@repo/database';
import { Prisma } from '@repo/database';
import { DatabaseService } from '../../../../shared/database';
import type {
  CreateAccountData,
  IAccountRepository,
  UpdateAccountData,
} from './account.repository.interface';

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

@Injectable()
export class AccountRepository implements IAccountRepository {
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

  async update(userId: string, id: string, data: UpdateAccountData): Promise<Account | null> {
    try {
      return await this.db.account.update({
        where: { id, userId },
        data,
      });
    } catch (error) {
      if (isRecordNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  async delete(userId: string, id: string): Promise<boolean> {
    try {
      await this.db.account.delete({
        where: { id, userId },
      });
      return true;
    } catch (error) {
      if (isRecordNotFound(error)) {
        return false;
      }
      throw error;
    }
  }
}
