import type { Account, AccountBalance, AccountType } from '@repo/database';

// DI token for NestJS
export const ACCOUNT_REPOSITORY = 'ACCOUNT_REPOSITORY';

// Data types for repository methods
export interface CreateAccountData {
  type?: AccountType;
  institution: string;
  name: string;
  externalId?: string;
  baseCurrency?: string;
  isActive?: boolean;
  notes?: string;
}

export interface UpdateAccountData {
  name?: string;
  baseCurrency?: string;
  isActive?: boolean;
  notes?: string;
  lastImportAt?: Date;
}

export interface UpsertBalanceData {
  currency: string;
  balance: number;
}

// Account with balances for enriched queries
export interface AccountWithBalances extends Account {
  balances: AccountBalance[];
}

// Repository interface
export interface IAccountRepository {
  findByUser(userId: string): Promise<Account[]>;
  findByUserWithBalances(userId: string): Promise<AccountWithBalances[]>;
  findOne(userId: string, id: string): Promise<Account | null>;
  findOneWithBalances(userId: string, id: string): Promise<AccountWithBalances | null>;
  findByInstitution(userId: string, institution: string): Promise<Account | null>;
  create(userId: string, data: CreateAccountData): Promise<Account>;
  update(userId: string, id: string, data: UpdateAccountData): Promise<Account | null>;
  delete(userId: string, id: string): Promise<boolean>;
  upsertBalance(accountId: string, data: UpsertBalanceData): Promise<AccountBalance>;
  getBalances(accountId: string): Promise<AccountBalance[]>;
}
