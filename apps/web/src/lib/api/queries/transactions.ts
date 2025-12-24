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

/**
 * Query key factory for transactions
 *
 * Hierarchical structure enables efficient invalidation:
 *   - transactionKeys.all → invalidates everything
 *   - transactionKeys.lists() → invalidates all list queries
 *   - transactionKeys.list(filters) → invalidates filtered list
 */
export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (filters?: TransactionFilters) =>
    filters ? ([...transactionKeys.lists(), filters] as const) : transactionKeys.lists(),
};

/**
 * Query options for fetching transactions with optional filters
 */
export function transactionListOptions(filters?: TransactionFilters) {
  return queryOptions({
    queryKey: transactionKeys.list(filters),
    queryFn: () => api.getTransactions(filters),
  });
}
