import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { prisma } from '@repo/database';

// Re-export the prisma type for use in services
type PrismaClientType = typeof prisma;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await prisma.$connect();
  }

  async onModuleDestroy() {
    await prisma.$disconnect();
  }

  // Expose prisma models as properties
  get account() {
    return prisma.account;
  }

  get security() {
    return prisma.security;
  }

  get position() {
    return prisma.position;
  }

  get transaction() {
    return prisma.transaction;
  }

  get priceHistory() {
    return prisma.priceHistory;
  }

  // Expose $transaction for multi-model operations
  $transaction: PrismaClientType['$transaction'] = prisma.$transaction.bind(prisma);
}
