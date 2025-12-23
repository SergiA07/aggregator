/**
 * Transaction Query Options
 *
 * Uses the official TanStack Query v5 `queryOptions` pattern.
 *
 * USAGE:
 *   import { useQuery } from '@tanstack/react-query';
 *   import { transactionListOptions } from '@/lib/api/queries/transactions';
 *
 *   const { data } = useQuery(transactionListOptions());
 *   const { data } = useQuery(transactionListOptions({ type: 'buy' }));
 *   const { data } = useQuery(transactionListOptions({ accountId: '123' }));
 */

import { queryOptions } from '@tanstack/react-query';
import { api } from '../client';

// Filter options for transaction queries
export interface TransactionFilters {
  accountId?: string;
  type?: string;
}

// Query key constants for invalidation
// `as const` makes these readonly and gives exact literal types
export const transactionKeys = {
  all: ['transactions'],
  lists: ['transactions', 'list'],
} as const;

/**
 * Query options for fetching transactions with optional filters
 */
export function transactionListOptions(filters?: TransactionFilters) {
  return queryOptions({
    queryKey: filters ? [...transactionKeys.lists, filters] : transactionKeys.lists,
    queryFn: () => api.getTransactions(filters),
  });
}
