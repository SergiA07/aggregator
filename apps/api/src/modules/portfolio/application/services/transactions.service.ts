import { Inject, Injectable } from '@nestjs/common';
import {
  type CreateTransactionData,
  type ITransactionRepository,
  TRANSACTION_REPOSITORY,
  type TransactionFilters,
  type TransactionStats,
  type TransactionWithRelations,
  type UpdateTransactionData,
} from '../../infrastructure/repositories';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async findByUser(
    userId: string,
    filters?: TransactionFilters,
  ): Promise<TransactionWithRelations[]> {
    return this.transactionRepository.findByUser(userId, filters);
  }

  async findOne(userId: string, id: string): Promise<TransactionWithRelations | null> {
    return this.transactionRepository.findOne(userId, id);
  }

  async create(userId: string, data: CreateTransactionData): Promise<TransactionWithRelations> {
    return this.transactionRepository.create(userId, data);
  }

  async update(
    _userId: string,
    id: string,
    data: UpdateTransactionData,
  ): Promise<TransactionWithRelations> {
    return this.transactionRepository.update(id, data);
  }

  async delete(_userId: string, id: string): Promise<void> {
    return this.transactionRepository.delete(id);
  }

  async getStats(userId: string, accountId?: string): Promise<TransactionStats> {
    return this.transactionRepository.getStats(userId, accountId);
  }
}
