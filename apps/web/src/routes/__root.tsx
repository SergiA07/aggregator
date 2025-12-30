import { createRootRouteWithContext } from '@tanstack/react-router';
import { ErrorFallback } from '@/components/error/error-fallback';
import { RootLayout } from '@/components/layout/root-layout';
import { FullPageSpinner } from '@/components/ui/loading-spinner';
import type { RouterContext } from '@/lib/router-context';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: ErrorFallback,
  pendingComponent: FullPageSpinner,
});
