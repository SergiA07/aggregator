import type { ErrorComponentProps } from '@tanstack/react-router';
import { RouteError } from '@/components/error/route-error';

export function DashboardError({ error, reset }: ErrorComponentProps) {
  return (
    <RouteError error={error} reset={reset} pageName="dashboard" retryLabel="Reload dashboard" />
  );
}
