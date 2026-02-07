import { createFileRoute } from '@tanstack/react-router';
import { Dashboard, DashboardError } from '@/features/dashboard';
import { prefetchPrices } from '@/lib/api/mutations/prices';
import { accountListOptions } from '@/lib/api/queries/accounts';
import { positionSummaryOptions } from '@/lib/api/queries/positions';

export const Route = createFileRoute('/_authenticated/dashboard')({
  loader: async ({ context: { queryClient } }) => {
    // Update prices first (fire-and-forget, don't block navigation)
    prefetchPrices();

    // Prefetch data in parallel
    await Promise.all([
      queryClient.ensureQueryData(positionSummaryOptions()),
      queryClient.ensureQueryData(accountListOptions()),
    ]);
  },
  component: Dashboard,
  errorComponent: DashboardError,
});
