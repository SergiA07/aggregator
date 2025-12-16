// Re-export Prisma client
export { PrismaClient, prisma } from './client.js';

// Re-export all Prisma types from generated client
export type {
  Account,
  BankAccount,
  BankTransaction,
  Position,
  PriceHistory,
  Security,
  Transaction,
} from './generated/prisma/client.js';

// Export Prisma namespace for advanced types
export { Prisma } from './generated/prisma/client.js';
