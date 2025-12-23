/**
 * Account types - matches Prisma Account model
 */

export interface Account {
  id: string;
  userId: string;
  broker: string;
  accountId: string;
  accountName?: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountInput {
  broker: string;
  accountId: string;
  accountName?: string;
  currency?: string;
}

export interface UpdateAccountInput {
  accountName?: string;
  currency?: string;
}
