import { createFileRoute, redirect } from '@tanstack/react-router';
import { ErrorFallback } from '@/components/error/error-fallback';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { CenteredSpinner } from '@/components/ui/loading-spinner';
import { supabase } from '@/lib/supabase';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const isDev = import.meta.env.DEV;

    if (!session && !isDev) {
      throw redirect({ to: '/login' });
    }
  },
  component: AuthenticatedLayout,
  pendingComponent: CenteredSpinner,
  errorComponent: ErrorFallback,
});
