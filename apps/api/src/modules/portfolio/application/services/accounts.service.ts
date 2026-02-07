import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Account, Transaction } from '@repo/database';
import type { AccountWithPerformance, AddValuationInput } from '@repo/shared-types/schemas';
import { decimalToNumberOrZero } from '@/shared/utils';
import {
  ACCOUNT_REPOSITORY,
  type CreateAccountData,
  type IAccountRepository,
  type ITransactionRepository,
  TRANSACTION_REPOSITORY,
  type UpdateAccountData,
} from '../../infrastructure/repositories';

@Injectable()
export class AccountsService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async findByUser(userId: string): Promise<Account[]> {
    return this.accountRepository.findByUser(userId);
  }

  async findOne(userId: string, id: string): Promise<Account | null> {
    return this.accountRepository.findOne(userId, id);
  }

  async create(userId: string, data: CreateAccountData): Promise<Account> {
    return this.accountRepository.create(userId, data);
  }

  async update(userId: string, id: string, data: UpdateAccountData): Promise<Account | null> {
    return this.accountRepository.update(userId, id, data);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    return this.accountRepository.delete(userId, id);
  }

  /**
   * Add a valuation to a pension/manual account.
   * Creates a valuation transaction and updates the account balance.
   */
  async addValuation(
    userId: string,
    accountId: string,
    data: AddValuationInput,
  ): Promise<{ transaction: Transaction; currentValue: number } | null> {
    // Verify account exists and belongs to user
    const account = await this.accountRepository.findOne(userId, accountId);
    if (!account) {
      return null;
    }

    // Only allow valuations for pension, real_estate, and other account types
    const allowedTypes = ['pension', 'real_estate', 'other'];
    if (!allowedTypes.includes(account.type)) {
      throw new BadRequestException(
        `Valuations are only allowed for pension, real_estate, and other account types. This account is type: ${account.type}`,
      );
    }

    // Create valuation transaction
    const transaction = await this.transactionRepository.create(userId, {
      accountId,
      date: data.date ? new Date(data.date) : new Date(),
      type: 'valuation',
      amount: data.amount,
      currency: account.baseCurrency,
      description: 'Manual valuation',
      notes: data.notes,
    });

    // Update account balance with the new value
    await this.accountRepository.upsertBalance(accountId, {
      currency: account.baseCurrency,
      balance: data.amount,
    });

    return {
      transaction,
      currentValue: data.amount,
    };
  }

  /**
   * Get valuation history for an account (transactions of type 'valuation').
   */
  async getValuations(userId: string, accountId: string): Promise<Transaction[]> {
    const transactions = await this.transactionRepository.findByUser(userId, {
      accountId,
      type: 'valuation',
    });
    return transactions;
  }

  /**
   * Get account with YTD performance metrics.
   * Calculates the percentage change from the first valuation of the year to the current value.
   */
  async getWithPerformance(
    userId: string,
    accountId: string,
  ): Promise<AccountWithPerformance | null> {
    const account = await this.accountRepository.findOneWithBalances(userId, accountId);
    if (!account) {
      return null;
    }

    // Get current value from balances
    const primaryBalance = account.balances.find((b) => b.currency === account.baseCurrency);
    const currentValue = decimalToNumberOrZero(primaryBalance?.balance);

    // Get valuations for YTD calculation
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const valuations = await this.transactionRepository.findByUser(userId, {
      accountId,
      type: 'valuation',
      startDate: startOfYear,
    });

    // Find the first valuation of the year (sorted by date ascending)
    const sortedValuations = valuations.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // If no valuations this year, try to get the last valuation from before the year
    let ytdStartValue: number | null = null;
    let lastValuationAt: string | null = null;

    if (sortedValuations.length > 0) {
      // Use the earliest valuation this year as the starting point
      ytdStartValue = decimalToNumberOrZero(sortedValuations[0].amount);
      // Last valuation is the most recent one
      lastValuationAt = sortedValuations[sortedValuations.length - 1].date.toISOString();
    } else {
      // Check for valuations before this year
      const previousValuations = await this.transactionRepository.findByUser(userId, {
        accountId,
        type: 'valuation',
        endDate: startOfYear,
      });

      if (previousValuations.length > 0) {
        // Use the most recent pre-year valuation as starting point
        const lastPreYear = previousValuations.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        )[0];
        ytdStartValue = decimalToNumberOrZero(lastPreYear.amount);
        lastValuationAt = lastPreYear.date.toISOString();
      }
    }

    // Calculate YTD change
    let ytdChange: number | null = null;
    let ytdChangePercent: number | null = null;

    if (ytdStartValue !== null && ytdStartValue > 0) {
      ytdChange = currentValue - ytdStartValue;
      ytdChangePercent = (ytdChange / ytdStartValue) * 100;
    }

    return {
      id: account.id,
      userId: account.userId,
      type: account.type,
      institution: account.institution,
      name: account.name,
      externalId: account.externalId,
      baseCurrency: account.baseCurrency,
      isActive: account.isActive,
      lastImportAt: account.lastImportAt?.toISOString() ?? null,
      notes: account.notes,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
      balances: account.balances.map((b) => ({
        id: b.id,
        accountId: b.accountId,
        currency: b.currency,
        balance: decimalToNumberOrZero(b.balance),
        updatedAt: b.updatedAt.toISOString(),
      })),
      currentValue,
      ytdStartValue,
      ytdChange,
      ytdChangePercent,
      lastValuationAt,
    };
  }
}
