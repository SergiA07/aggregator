import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, Transaction } from '@repo/database';
import { DatabaseService } from '../database';

export interface TransactionFilters {
  accountId?: string;
  securityId?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class TransactionsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async findByUser(userId: string, filters?: TransactionFilters): Promise<Transaction[]> {
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

  async findOne(userId: string, id: string): Promise<Transaction | null> {
    return this.db.transaction.findFirst({
      where: { id, userId },
      include: {
        account: true,
        security: true,
      },
    });
  }

  async create(
    userId: string,
    data: {
      accountId: string;
      securityId: string;
      date: Date;
      type: string;
      quantity: number;
      price: number;
      amount: number;
      fees?: number;
      currency?: string;
      notes?: string;
      externalId?: string;
    },
  ): Promise<Transaction> {
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

  async update(
    _userId: string,
    id: string,
    data: {
      date?: Date;
      type?: string;
      quantity?: number;
      price?: number;
      amount?: number;
      fees?: number;
      currency?: string;
      notes?: string;
    },
  ): Promise<Transaction> {
    return this.db.transaction.update({
      where: { id },
      data,
      include: {
        account: true,
        security: true,
      },
    });
  }

  async delete(_userId: string, id: string): Promise<void> {
    await this.db.transaction.delete({
      where: { id },
    });
  }

  async getStats(userId: string, accountId?: string) {
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

    const stats = {
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
