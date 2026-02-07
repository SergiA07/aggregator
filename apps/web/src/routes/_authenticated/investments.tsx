import { createFileRoute } from '@tanstack/react-router';
import { Investments, InvestmentsError } from '@/features/investments';
import { prefetchPrices } from '@/lib/api/mutations/prices';
import { positionListOptions, positionSummaryOptions } from '@/lib/api/queries/positions';

export const Route = createFileRoute('/_authenticated/investments')({
  loader: async ({ context: { queryClient } }) => {
    // Update prices first (fire-and-forget, don't block navigation)
    prefetchPrices();

    // Prefetch data in parallel (uses cache if fresh, fetches if stale)
    await Promise.all([
      queryClient.ensureQueryData(positionListOptions()),
      queryClient.ensureQueryData(positionSummaryOptions()),
    ]);
  },
  component: Investments,
  errorComponent: InvestmentsError,
});
