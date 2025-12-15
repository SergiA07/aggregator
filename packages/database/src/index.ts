// Re-export Prisma client
export { prisma, PrismaClient } from './client';

// Re-export all Prisma types from generated client
export type {
  Account,
  Security,
  Transaction,
  Position,
  BankAccount,
  BankTransaction,
  PriceHistory,
} from './generated/prisma/client.js';

// Export Prisma namespace for advanced types
export { Prisma } from './generated/prisma/client.js';
