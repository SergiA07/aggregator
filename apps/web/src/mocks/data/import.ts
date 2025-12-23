/**
 * Mock data for import
 */
import type { ImportResult, SupportedBroker } from '@repo/shared-types';

export const mockSupportedBrokers: SupportedBroker[] = [
  { id: 'degiro', name: 'DEGIRO', country: 'NL' },
  { id: 'interactive-brokers', name: 'Interactive Brokers', country: 'US' },
  { id: 'trade-republic', name: 'Trade Republic', country: 'DE' },
];

export const mockImportResult: ImportResult = {
  success: true,
  broker: 'degiro',
  accountId: 'acc-1',
  transactionsImported: 15,
  positionsCreated: 5,
  securitiesCreated: 3,
  errors: [],
};
