/**
 * Import types - for CSV/file import operations
 */

export interface ImportResult {
  success: boolean;
  broker: string;
  accountId?: string;
  transactionsImported: number;
  positionsCreated: number;
  securitiesCreated: number;
  errors: string[];
}

export interface SupportedBroker {
  id: string;
  name: string;
  country: string;
}
