import type { Transaction } from '@repo/database';

// DI token for NestJS
export const TRANSACTION_REPOSITORY = 'TRANSACTION_REPOSITORY';

// Filter options for querying transactions
export interface TransactionFilters {
  accountId?: string;
  securityId?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
}

// Transaction with relations for API responses
export interface TransactionWithRelations extends Transaction {
  account?: { id: string; broker: string; accountName: string | null };
  security?: { id: string; symbol: string; name: string };
}

// Data types for repository methods
export interface CreateTransactionData {
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
}

export interface UpdateTransactionData {
  date?: Date;
  type?: string;
  quantity?: number;
  price?: number;
  amount?: number;
  fees?: number;
  currency?: string;
  notes?: string;
}

// Stats result type
export interface TransactionStats {
  totalTransactions: number;
  totalBuys: number;
  totalSells: number;
  totalDividends: number;
  totalFees: number;
  buyAmount: number;
  sellAmount: number;
  dividendAmount: number;
}

// Repository interface
export interface ITransactionRepository {
  findByUser(userId: string, filters?: TransactionFilters): Promise<TransactionWithRelations[]>;
  findOne(userId: string, id: string): Promise<TransactionWithRelations | null>;
  create(userId: string, data: CreateTransactionData): Promise<TransactionWithRelations>;
  update(
    userId: string,
    id: string,
    data: UpdateTransactionData,
  ): Promise<TransactionWithRelations | null>;
  delete(userId: string, id: string): Promise<boolean>;
  getStats(userId: string, accountId?: string): Promise<TransactionStats>;
}
