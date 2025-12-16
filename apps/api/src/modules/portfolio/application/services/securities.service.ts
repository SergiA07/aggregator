import { Inject, Injectable } from '@nestjs/common';
import type { Security } from '@repo/database';
import {
  type CreateSecurityData,
  type GetOrCreateSecurityData,
  type ISecurityRepository,
  SECURITY_REPOSITORY,
  type UpdateSecurityData,
} from '../../infrastructure/repositories';

@Injectable()
export class SecuritiesService {
  constructor(
    @Inject(SECURITY_REPOSITORY)
    private readonly securityRepository: ISecurityRepository,
  ) {}

  async findAll(search?: string): Promise<Security[]> {
    return this.securityRepository.findAll(search);
  }

  async findOne(id: string): Promise<Security | null> {
    return this.securityRepository.findOne(id);
  }

  async findByIsin(isin: string): Promise<Security | null> {
    return this.securityRepository.findByIsin(isin);
  }

  async findBySymbol(symbol: string): Promise<Security | null> {
    return this.securityRepository.findBySymbol(symbol);
  }

  async create(data: CreateSecurityData): Promise<Security> {
    return this.securityRepository.create(data);
  }

  async update(id: string, data: UpdateSecurityData): Promise<Security> {
    return this.securityRepository.update(id, data);
  }

  async delete(id: string): Promise<void> {
    return this.securityRepository.delete(id);
  }

  async getOrCreate(data: GetOrCreateSecurityData): Promise<Security> {
    return this.securityRepository.getOrCreate(data);
  }

  async getSecuritiesWithPositions(userId: string): Promise<Security[]> {
    return this.securityRepository.getSecuritiesWithPositions(userId);
  }
}
