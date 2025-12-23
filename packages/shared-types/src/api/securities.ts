/**
 * Security types - matches Prisma Security model
 */

export interface Security {
  id: string;
  symbol: string;
  isin?: string | null;
  name: string;
  securityType: string;
  currency: string;
  exchange?: string | null;
  sector?: string | null;
  industry?: string | null;
  country?: string | null;
}

export interface CreateSecurityInput {
  symbol: string;
  isin?: string;
  name: string;
  securityType?: string;
  currency?: string;
  exchange?: string;
}
