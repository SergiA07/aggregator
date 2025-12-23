import { createRouter } from '@tanstack/react-router';
import { ErrorFallback } from '@/components/error/error-fallback';
import { routeTree } from '@/routeTree.gen';
import { queryClient } from './api/query-client';

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultErrorComponent: ErrorFallback,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
