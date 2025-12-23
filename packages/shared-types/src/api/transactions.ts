/**
 * Transaction types - matches Prisma Transaction model
 */
import type { Account } from './accounts';
import type { Security } from './securities';

export type TransactionType = 'buy' | 'sell' | 'dividend' | 'split' | 'transfer' | 'fee' | 'other';

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  securityId: string;
  date: string;
  type: TransactionType;
  quantity: number;
  price: number;
  amount: number;
  fees: number;
  currency: string;
  notes?: string | null;
  externalId?: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated relations (optional)
  account?: Account;
  security?: Security;
}

export interface CreateTransactionInput {
  accountId: string;
  securityId: string;
  date: string;
  type: TransactionType;
  quantity: number;
  price: number;
  amount: number;
  fees?: number;
  currency?: string;
  notes?: string;
  externalId?: string;
}

export interface TransactionFilters {
  accountId?: string;
  securityId?: string;
  type?: TransactionType;
  from?: string;
  to?: string;
}

export interface TransactionStats {
  totalTransactions: number;
  totalBuys: number;
  totalSells: number;
  totalDividends: number;
  totalFees: number;
}
