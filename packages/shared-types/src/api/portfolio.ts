/**
 * Portfolio API types - shared between frontend and backend
 */

// Transaction types
export type TransactionType = 'buy' | 'sell' | 'dividend' | 'split' | 'transfer' | 'fee' | 'other';

// Account types
export type AccountType = 'brokerage' | 'retirement' | 'crypto' | 'bank' | 'other';

// Account
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  broker?: string;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  broker?: string;
  currency?: string;
}

export interface UpdateAccountInput {
  name?: string;
  type?: AccountType;
  broker?: string;
  currency?: string;
  isActive?: boolean;
}

// Security
export interface Security {
  id: string;
  symbol: string;
  isin?: string;
  name: string;
  type: string;
  currency: string;
  exchange?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSecurityInput {
  symbol: string;
  isin?: string;
  name: string;
  type?: string;
  currency?: string;
  exchange?: string;
}

// Transaction
export interface Transaction {
  id: string;
  accountId: string;
  securityId: string;
  date: string;
  type: TransactionType;
  quantity: number;
  price: number;
  amount: number;
  fees: number;
  currency: string;
  notes?: string;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
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

// Position (calculated from transactions)
export interface Position {
  id: string;
  accountId: string;
  securityId: string;
  quantity: number;
  avgCost: number;
  totalCost: number;
  currency: string;
  security?: Security;
  account?: Account;
}

// Position summary with current value
export interface PositionSummary extends Position {
  currentPrice?: number;
  currentValue?: number;
  unrealizedGain?: number;
  unrealizedGainPercent?: number;
}

// Portfolio summary
export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  positions: PositionSummary[];
  byAccount: {
    accountId: string;
    accountName: string;
    value: number;
    gain: number;
  }[];
}

// Import result
export interface ImportResult {
  success: boolean;
  imported: {
    transactions: number;
    positions: number;
  };
  errors: string[];
  broker: string;
}
