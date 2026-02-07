import type { Transaction, TransactionType } from '@repo/database';

// DI token for NestJS
export const TRANSACTION_REPOSITORY = 'TRANSACTION_REPOSITORY';

// Filter options for querying transactions
export interface TransactionFilters {
  accountId?: string;
  securityId?: string;
  type?: TransactionType;
  types?: TransactionType[];
  startDate?: Date;
  endDate?: Date;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
}

// Transaction with relations for API responses
export interface TransactionWithRelations extends Transaction {
  account?: { id: string; institution: string; name: string };
  security?: { id: string; symbol: string; name: string } | null;
}

// Data types for repository methods
export interface CreateTransactionData {
  accountId: string;
  securityId?: string; // Optional: not needed for bank/pension transactions
  date: Date;
  type: TransactionType;
  quantity?: number; // Optional: not needed for cash transactions
  price?: number; // Optional: not needed for cash transactions
  amount: number;
  fees?: number;
  currency?: string;
  description?: string;
  category?: string;
  notes?: string;
  externalId?: string;
  fingerprint?: string;
}

export interface UpdateTransactionData {
  date?: Date;
  type?: TransactionType;
  quantity?: number | null;
  price?: number | null;
  amount?: number;
  fees?: number;
  currency?: string;
  description?: string | null;
  category?: string | null;
  notes?: string | null;
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
