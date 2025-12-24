import type { Security } from '@repo/database';

// DI token for NestJS
export const SECURITY_REPOSITORY = 'SECURITY_REPOSITORY';

// Data types for repository methods
export interface CreateSecurityData {
  symbol: string;
  isin?: string;
  name: string;
  securityType: string;
  currency?: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  country?: string;
}

export interface UpdateSecurityData {
  symbol?: string;
  name?: string;
  securityType?: string;
  currency?: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  country?: string;
}

export interface GetOrCreateSecurityData {
  symbol: string;
  isin?: string;
  name: string;
  securityType?: string;
  currency?: string;
}

// Repository interface
export interface ISecurityRepository {
  findAll(search?: string): Promise<Security[]>;
  findOne(id: string): Promise<Security | null>;
  findByIsin(isin: string): Promise<Security | null>;
  findBySymbol(symbol: string): Promise<Security | null>;
  create(data: CreateSecurityData): Promise<Security>;
  update(id: string, data: UpdateSecurityData): Promise<Security | null>;
  delete(id: string): Promise<boolean>;
  getOrCreate(data: GetOrCreateSecurityData): Promise<Security>;
  getSecuritiesWithPositions(userId: string): Promise<Security[]>;
}
