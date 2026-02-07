/**
 * Overview Query Options
 *
 * Uses the official TanStack Query v5 `queryOptions` pattern.
 * Prices are refreshed via route loaders before navigation completes.
 * Auto-refresh every 60 seconds while on page via refetchInterval.
 */

import { queryOptions } from '@tanstack/react-query';
import { api, type PerformancePeriod } from '../client';

export type { PerformancePeriod } from '../client';

// Auto-refresh interval for real-time price updates (1 minute)
const PRICE_REFRESH_INTERVAL = 60_000;

/**
 * Query key factory for overview
 */
export const overviewKeys = {
  all: ['overview'] as const,
  summary: () => [...overviewKeys.all, 'summary'] as const,
  accounts: (period?: PerformancePeriod) => [...overviewKeys.all, 'accounts', period] as const,
  activity: (limit?: number) => [...overviewKeys.all, 'activity', limit] as const,
};

/**
 * Query options for fetching overview summary
 * Auto-refreshes every 60 seconds for real-time updates
 */
export function overviewSummaryOptions() {
  return queryOptions({
    queryKey: overviewKeys.summary(),
    queryFn: api.getOverviewSummary,
    staleTime: 30_000, // Consider fresh for 30 seconds
    gcTime: 60_000, // Keep in cache for 1 minute
    refetchInterval: PRICE_REFRESH_INTERVAL, // Auto-refresh every 60 seconds
    refetchIntervalInBackground: false, // Pause when tab is hidden
  });
}

/**
 * Query options for fetching all accounts with values
 * Auto-refreshes every 60 seconds for real-time updates
 * @param period - Performance period for change calculations (default: 'ytd')
 */
export function overviewAccountsOptions(period?: PerformancePeriod) {
  return queryOptions({
    queryKey: overviewKeys.accounts(period),
    queryFn: () => api.getOverviewAccounts(period),
    staleTime: 30_000,
    gcTime: 60_000,
    refetchInterval: PRICE_REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });
}

/**
 * Query options for fetching recent activity
 * No auto-refresh needed - activity doesn't change frequently
 */
export function recentActivityOptions(limit = 10) {
  return queryOptions({
    queryKey: overviewKeys.activity(limit),
    queryFn: () => api.getRecentActivity(limit),
    staleTime: 60_000, // Consider fresh for 1 minute
    gcTime: 5 * 60_000, // Keep in cache for 5 minutes
  });
}
