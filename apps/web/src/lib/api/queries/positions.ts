/**
 * Position Query Options
 *
 * Uses the official TanStack Query v5 `queryOptions` pattern.
 * Prices are refreshed via route loaders before navigation completes.
 * Auto-refresh every 60 seconds while on page via refetchInterval.
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

// Auto-refresh interval for real-time price updates (1 minute)
const PRICE_REFRESH_INTERVAL = 60_000;

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
 * Auto-refreshes every 60 seconds for real-time updates
 */
export function positionListOptions() {
  return queryOptions({
    queryKey: positionKeys.lists(),
    queryFn: api.getPositions,
    staleTime: 30_000, // Consider fresh for 30 seconds
    gcTime: 60_000, // Keep in cache for 1 minute
    refetchInterval: PRICE_REFRESH_INTERVAL, // Auto-refresh every 60 seconds
    refetchIntervalInBackground: false, // Pause when tab is hidden
  });
}

/**
 * Query options for fetching positions summary (totals, P&L, etc.)
 * Auto-refreshes every 60 seconds for real-time updates
 */
export function positionSummaryOptions() {
  return queryOptions({
    queryKey: positionKeys.summary(),
    queryFn: api.getPositionsSummary,
    staleTime: 30_000,
    gcTime: 60_000,
    refetchInterval: PRICE_REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });
}

/**
 * Query options for fetching positions by account ID
 * Auto-refreshes every 60 seconds for real-time updates
 */
export function positionsByAccountOptions(accountId: string) {
  return queryOptions({
    queryKey: positionKeys.list({ accountId }),
    queryFn: () => api.getPositionsByAccount(accountId),
    enabled: !!accountId,
    staleTime: 30_000,
    gcTime: 60_000,
    refetchInterval: PRICE_REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });
}
