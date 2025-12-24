/**
 * Position Query Options
 *
 * Uses the official TanStack Query v5 `queryOptions` pattern.
 *
 * USAGE:
 *   import { useQuery } from '@tanstack/react-query';
 *   import { positionListOptions, positionSummaryOptions } from '@/lib/api/queries/positions';
 *
 *   const { data } = useQuery(positionListOptions());
 *   const { data: summary } = useQuery(positionSummaryOptions());
 *   const { data } = useQuery(positionsByAccountOptions(accountId));
 */

import { queryOptions } from '@tanstack/react-query';
import { api } from '../client';

/**
 * Query key factory for positions
 *
 * Hierarchical structure enables efficient invalidation:
 *   - positionKeys.all → invalidates everything
 *   - positionKeys.lists() → invalidates all list queries
 *   - positionKeys.list({ accountId }) → invalidates filtered list
 *   - positionKeys.summary() → invalidates summary
 */
export const positionKeys = {
  all: ['positions'] as const,
  lists: () => [...positionKeys.all, 'list'] as const,
  list: (filters: { accountId?: string }) => [...positionKeys.lists(), filters] as const,
  summary: () => [...positionKeys.all, 'summary'] as const,
};

/**
 * Query options for fetching all positions
 */
export function positionListOptions() {
  return queryOptions({
    queryKey: positionKeys.lists(),
    queryFn: api.getPositions,
  });
}

/**
 * Query options for fetching positions summary (totals, P&L, etc.)
 */
export function positionSummaryOptions() {
  return queryOptions({
    queryKey: positionKeys.summary(),
    queryFn: api.getPositionsSummary,
  });
}

/**
 * Query options for fetching positions by account ID
 */
export function positionsByAccountOptions(accountId: string) {
  return queryOptions({
    queryKey: positionKeys.list({ accountId }),
    queryFn: () => api.getPositionsByAccount(accountId),
    enabled: !!accountId,
  });
}
