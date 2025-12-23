/**
 * Bank account types - matches Prisma BankAccount and BankTransaction models
 */

export interface BankAccount {
  id: string;
  userId: string;
  iban?: string | null;
  bankName: string;
  accountName?: string | null;
  currency: string;
  balance: number;
  lastSynced?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransaction {
  id: string;
  userId: string;
  bankAccountId: string;
  date: string;
  description: string;
  amount: number;
  balance?: number | null;
  category?: string | null;
  reference?: string | null;
  createdAt: string;
  bankAccount?: BankAccount;
}
