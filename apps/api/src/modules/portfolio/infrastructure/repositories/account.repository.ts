import { Inject, Injectable } from '@nestjs/common';
import type { Account, AccountBalance } from '@repo/database';
import { Prisma } from '@repo/database';
import { DatabaseService } from '@/shared/database';
import type {
  AccountWithBalances,
  CreateAccountData,
  IAccountRepository,
  UpdateAccountData,
  UpsertBalanceData,
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

  async findByUserWithBalances(userId: string): Promise<AccountWithBalances[]> {
    return this.db.account.findMany({
      where: { userId },
      include: { balances: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string): Promise<Account | null> {
    return this.db.account.findFirst({
      where: { id, userId },
    });
  }

  async findOneWithBalances(userId: string, id: string): Promise<AccountWithBalances | null> {
    return this.db.account.findFirst({
      where: { id, userId },
      include: { balances: true },
    });
  }

  async findByInstitution(userId: string, institution: string): Promise<Account | null> {
    return this.db.account.findFirst({
      where: { userId, institution },
    });
  }

  async create(userId: string, data: CreateAccountData): Promise<Account> {
    return this.db.account.create({
      data: {
        userId,
        type: data.type ?? 'broker',
        institution: data.institution,
        name: data.name,
        externalId: data.externalId,
        baseCurrency: data.baseCurrency ?? 'EUR',
        isActive: data.isActive ?? true,
        notes: data.notes,
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

  async upsertBalance(accountId: string, data: UpsertBalanceData): Promise<AccountBalance> {
    return this.db.accountBalance.upsert({
      where: {
        accountId_currency: {
          accountId,
          currency: data.currency,
        },
      },
      update: {
        balance: new Prisma.Decimal(data.balance),
      },
      create: {
        accountId,
        currency: data.currency,
        balance: new Prisma.Decimal(data.balance),
      },
    });
  }

  async getBalances(accountId: string): Promise<AccountBalance[]> {
    return this.db.accountBalance.findMany({
      where: { accountId },
      orderBy: { currency: 'asc' },
    });
  }
}
