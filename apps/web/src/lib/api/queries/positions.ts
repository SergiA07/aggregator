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

// Query key constants for invalidation
// `as const` makes these readonly and gives exact literal types
export const positionKeys = {
  all: ['positions'],
  lists: ['positions', 'list'],
  summaries: ['positions', 'summary'],
  byAccount: ['positions', 'byAccount'],
} as const;

/**
 * Query options for fetching all positions
 */
export function positionListOptions() {
  return queryOptions({
    queryKey: positionKeys.lists,
    queryFn: api.getPositions,
  });
}

/**
 * Query options for fetching positions summary (totals, P&L, etc.)
 */
export function positionSummaryOptions() {
  return queryOptions({
    queryKey: positionKeys.summaries,
    queryFn: api.getPositionsSummary,
  });
}

/**
 * Query options for fetching positions by account ID
 */
export function positionsByAccountOptions(accountId: string) {
  return queryOptions({
    queryKey: [...positionKeys.byAccount, accountId],
    queryFn: () => api.getPositionsByAccount(accountId),
    enabled: !!accountId,
  });
}
