/**
 * Account types - matches Prisma Account model
 */

export interface Account {
  id: string;
  userId: string;
  /** @deprecated Use institution instead */
  broker?: string;
  type: 'broker' | 'bank' | 'pension' | 'crypto' | 'real_estate' | 'other';
  institution: string;
  name: string;
  externalId?: string | null;
  baseCurrency: string;
  isActive: boolean;
  lastImportAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountInput {
  type?: 'broker' | 'bank' | 'pension' | 'crypto' | 'real_estate' | 'other';
  institution: string;
  name: string;
  externalId?: string;
  baseCurrency?: string;
  isActive?: boolean;
  notes?: string;
}

export interface UpdateAccountInput {
  name?: string;
  baseCurrency?: string;
  isActive?: boolean;
  notes?: string;
}
