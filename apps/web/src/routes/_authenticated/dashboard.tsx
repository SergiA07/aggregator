import { createFileRoute } from '@tanstack/react-router';
import { Dashboard, DashboardError } from '@/features/dashboard';

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: Dashboard,
  errorComponent: DashboardError,
});
