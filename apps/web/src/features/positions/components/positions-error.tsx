import type { ErrorComponentProps } from '@tanstack/react-router';
import { RouteError } from '@/components/error/route-error';

export function PositionsError({ error, reset }: ErrorComponentProps) {
  return (
    <RouteError error={error} reset={reset} pageName="positions" retryLabel="Reload positions" />
  );
}
