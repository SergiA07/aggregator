import { createFileRoute } from '@tanstack/react-router';
import { Overview } from '@/features/overview';
import { prefetchPrices } from '@/lib/api/mutations/prices';
import { overviewAccountsOptions, overviewSummaryOptions } from '@/lib/api/queries/overview';

export const Route = createFileRoute('/_authenticated/overview')({
  loader: async ({ context: { queryClient } }) => {
    // Update prices first (fire-and-forget, don't block navigation)
    prefetchPrices();

    // Prefetch data in parallel (uses cache if fresh, fetches if stale)
    await Promise.all([
      queryClient.ensureQueryData(overviewSummaryOptions()),
      queryClient.ensureQueryData(overviewAccountsOptions()),
    ]);
  },
  component: Overview,
});
