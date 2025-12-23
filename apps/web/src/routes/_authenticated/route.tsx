import { createFileRoute, redirect } from '@tanstack/react-router';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { supabase } from '@/lib/supabase';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const isDev = import.meta.env.VITE_DEV_MODE === 'true';

    if (!session && !isDev) {
      throw redirect({ to: '/login' });
    }
  },
  component: AuthenticatedLayout,
});
