/**
 * Account Query Options
 *
 * Uses the official TanStack Query v5 `queryOptions` pattern.
 * Each function returns a configuration object that can be used with:
 *   - useQuery(accountListOptions())
 *   - useSuspenseQuery(accountListOptions())
 *   - queryClient.prefetchQuery(accountListOptions())
 *   - queryClient.getQueryData(accountListOptions().queryKey)
 *
 * USAGE:
 *   import { useQuery } from '@tanstack/react-query';
 *   import { accountListOptions, accountDetailOptions } from '@/lib/api/queries/accounts';
 *
 *   const { data } = useQuery(accountListOptions());
 *   const { data } = useQuery(accountDetailOptions('123'));
 */

import { queryOptions } from '@tanstack/react-query';
import { api } from '../client';

/**
 * Query key factory for accounts
 *
 * Hierarchical structure enables efficient invalidation:
 *   - accountKeys.all → invalidates everything
 *   - accountKeys.lists() → invalidates all list queries
 *   - accountKeys.detail(id) → invalidates specific account
 */
export const accountKeys = {
  all: ['accounts'] as const,
  lists: () => [...accountKeys.all, 'list'] as const,
  detail: (id: string) => [...accountKeys.all, 'detail', id] as const,
};

/**
 * Query options for fetching all accounts
 */
export function accountListOptions() {
  return queryOptions({
    queryKey: accountKeys.lists(),
    queryFn: api.getAccounts,
  });
}

/**
 * Query options for fetching a single account by ID
 */
export function accountDetailOptions(id: string) {
  return queryOptions({
    queryKey: accountKeys.detail(id),
    queryFn: () => api.getAccount(id),
    enabled: !!id,
  });
}
