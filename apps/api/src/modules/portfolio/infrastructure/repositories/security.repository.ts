import { Injectable } from '@nestjs/common';
import type { Security } from '@repo/database';
import type { DatabaseService } from '../../../../shared/database';
import type {
  CreateSecurityData,
  GetOrCreateSecurityData,
  ISecurityRepository,
  UpdateSecurityData,
} from './security.repository.interface';

@Injectable()
export class SecurityRepository implements ISecurityRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(search?: string): Promise<Security[]> {
    if (search) {
      return this.db.security.findMany({
        where: {
          OR: [
            { symbol: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { isin: { contains: search, mode: 'insensitive' } },
          ],
        },
        orderBy: { symbol: 'asc' },
        take: 50,
      });
    }

    return this.db.security.findMany({
      orderBy: { symbol: 'asc' },
      take: 100,
    });
  }

  async findOne(id: string): Promise<Security | null> {
    return this.db.security.findUnique({
      where: { id },
    });
  }

  async findByIsin(isin: string): Promise<Security | null> {
    return this.db.security.findUnique({
      where: { isin },
    });
  }

  async findBySymbol(symbol: string): Promise<Security | null> {
    return this.db.security.findFirst({
      where: { symbol },
    });
  }

  async create(data: CreateSecurityData): Promise<Security> {
    return this.db.security.create({
      data: {
        symbol: data.symbol,
        isin: data.isin,
        name: data.name,
        securityType: data.securityType,
        currency: data.currency ?? 'EUR',
        exchange: data.exchange,
        sector: data.sector,
        industry: data.industry,
        country: data.country,
      },
    });
  }

  async update(id: string, data: UpdateSecurityData): Promise<Security> {
    return this.db.security.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.security.delete({
      where: { id },
    });
  }

  async getOrCreate(data: GetOrCreateSecurityData): Promise<Security> {
    // Try to find by ISIN first
    if (data.isin) {
      const byIsin = await this.findByIsin(data.isin);
      if (byIsin) return byIsin;
    }

    // Try to find by symbol
    const bySymbol = await this.findBySymbol(data.symbol);
    if (bySymbol) return bySymbol;

    // Create new security
    return this.create({
      symbol: data.symbol,
      isin: data.isin,
      name: data.name,
      securityType: data.securityType ?? 'stock',
      currency: data.currency ?? 'EUR',
    });
  }

  async getSecuritiesWithPositions(userId: string): Promise<Security[]> {
    const positions = await this.db.position.findMany({
      where: { userId },
      select: { securityId: true },
      distinct: ['securityId'],
    });

    const securityIds = positions.map((p) => p.securityId);

    return this.db.security.findMany({
      where: { id: { in: securityIds } },
      orderBy: { symbol: 'asc' },
    });
  }
}
