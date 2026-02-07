/**
 * Price Mutations
 *
 * Handles price updates with proper cache invalidation.
 * Uses TanStack Query's mutation pattern for consistency.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { overviewKeys } from '../queries/overview';
import { positionKeys } from '../queries/positions';

/**
 * Mutation to refresh all position prices from Yahoo Finance/justETF.
 * Automatically invalidates position and overview queries on success.
 */
export function useRefreshPrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.updatePrices,
    onSuccess: () => {
      // Invalidate all price-dependent queries
      queryClient.invalidateQueries({ queryKey: positionKeys.all });
      queryClient.invalidateQueries({ queryKey: overviewKeys.all });
    },
  });
}

/**
 * Prefetch prices - used in route loaders.
 * Returns a promise that resolves when prices are updated.
 */
export async function prefetchPrices(): Promise<void> {
  try {
    await api.updatePrices();
  } catch (error) {
    // Don't block navigation on price update failure
    console.warn('[Prices] Failed to update prices:', error);
  }
}
