import type { Account } from '@repo/database';

// DI token for NestJS
export const ACCOUNT_REPOSITORY = 'ACCOUNT_REPOSITORY';

// Data types for repository methods
export interface CreateAccountData {
  broker: string;
  accountId: string;
  accountName?: string;
  currency?: string;
}

export interface UpdateAccountData {
  accountName?: string;
  currency?: string;
}

// Repository interface
export interface IAccountRepository {
  findByUser(userId: string): Promise<Account[]>;
  findOne(userId: string, id: string): Promise<Account | null>;
  findByBroker(userId: string, broker: string): Promise<Account | null>;
  create(userId: string, data: CreateAccountData): Promise<Account>;
  update(userId: string, id: string, data: UpdateAccountData): Promise<Account | null>;
  delete(userId: string, id: string): Promise<boolean>;
}
