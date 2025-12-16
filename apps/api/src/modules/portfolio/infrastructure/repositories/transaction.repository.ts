import { Injectable } from '@nestjs/common';
import type { Prisma } from '@repo/database';
import type { DatabaseService } from '../../../../shared/database';
import type {
  CreateTransactionData,
  ITransactionRepository,
  TransactionFilters,
  TransactionStats,
  TransactionWithRelations,
  UpdateTransactionData,
} from './transaction.repository.interface';

@Injectable()
export class TransactionRepository implements ITransactionRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByUser(
    userId: string,
    filters?: TransactionFilters,
  ): Promise<TransactionWithRelations[]> {
    const where: Prisma.TransactionWhereInput = { userId };

    if (filters?.accountId) {
      where.accountId = filters.accountId;
    }
    if (filters?.securityId) {
      where.securityId = filters.securityId;
    }
    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.date.lte = filters.endDate;
      }
    }

    return this.db.transaction.findMany({
      where,
      include: {
        account: true,
        security: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(userId: string, id: string): Promise<TransactionWithRelations | null> {
    return this.db.transaction.findFirst({
      where: { id, userId },
      include: {
        account: true,
        security: true,
      },
    });
  }

  async create(userId: string, data: CreateTransactionData): Promise<TransactionWithRelations> {
    return this.db.transaction.create({
      data: {
        userId,
        accountId: data.accountId,
        securityId: data.securityId,
        date: data.date,
        type: data.type,
        quantity: data.quantity,
        price: data.price,
        amount: data.amount,
        fees: data.fees ?? 0,
        currency: data.currency ?? 'EUR',
        notes: data.notes,
        externalId: data.externalId,
      },
      include: {
        account: true,
        security: true,
      },
    });
  }

  async update(id: string, data: UpdateTransactionData): Promise<TransactionWithRelations> {
    return this.db.transaction.update({
      where: { id },
      data,
      include: {
        account: true,
        security: true,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.transaction.delete({
      where: { id },
    });
  }

  async getStats(userId: string, accountId?: string): Promise<TransactionStats> {
    const where: Prisma.TransactionWhereInput = { userId };
    if (accountId) {
      where.accountId = accountId;
    }

    const transactions = await this.db.transaction.findMany({
      where,
      select: {
        type: true,
        amount: true,
        fees: true,
      },
    });

    const stats: TransactionStats = {
      totalTransactions: transactions.length,
      totalBuys: 0,
      totalSells: 0,
      totalDividends: 0,
      totalFees: 0,
      buyAmount: 0,
      sellAmount: 0,
      dividendAmount: 0,
    };

    for (const tx of transactions) {
      const amount = tx.amount.toNumber();
      const fees = tx.fees.toNumber();

      stats.totalFees += fees;

      switch (tx.type) {
        case 'buy':
          stats.totalBuys++;
          stats.buyAmount += amount;
          break;
        case 'sell':
          stats.totalSells++;
          stats.sellAmount += amount;
          break;
        case 'dividend':
          stats.totalDividends++;
          stats.dividendAmount += amount;
          break;
      }
    }

    return stats;
  }
}
