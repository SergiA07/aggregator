import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Global QueryClient configuration (TanStack Query v5)
 *
 * Uses QueryCache/MutationCache for global error handling (v5 best practice)
 * @see https://tanstack.com/query/v5/docs/reference/QueryClient
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // Global error handler for background refetch failures only
    // Initial load errors are handled by component UI (error states)
    // @see https://github.com/TanStack/query/discussions/5099
    onError: (error, query) => {
      if (query.state.data !== undefined) {
        const message = error instanceof Error ? error.message : 'Failed to refresh data';
        toast.error(message);
      }
    },
  }),
  mutationCache: new MutationCache({
    // Global error handler for all mutations
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast.error(message);
    },
  }),
  defaultOptions: {
    queries: {
      // Data is fresh for 30 seconds (won't refetch during this time)
      staleTime: 30 * 1000,
      // Keep unused data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry failed requests once
      retry: 1,
      // Refetch when window regains focus
      refetchOnWindowFocus: true,
    },
  },
});
