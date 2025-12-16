import { Inject, Injectable } from '@nestjs/common';
import type { Account } from '@repo/database';
import {
  ACCOUNT_REPOSITORY,
  type CreateAccountData,
  type IAccountRepository,
  type UpdateAccountData,
} from '../../infrastructure/repositories';

@Injectable()
export class AccountsService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async findByUser(userId: string): Promise<Account[]> {
    return this.accountRepository.findByUser(userId);
  }

  async findOne(userId: string, id: string): Promise<Account | null> {
    return this.accountRepository.findOne(userId, id);
  }

  async create(userId: string, data: CreateAccountData): Promise<Account> {
    return this.accountRepository.create(userId, data);
  }

  async update(_userId: string, id: string, data: UpdateAccountData): Promise<Account> {
    return this.accountRepository.update(id, data);
  }

  async delete(_userId: string, id: string): Promise<void> {
    return this.accountRepository.delete(id);
  }
}
