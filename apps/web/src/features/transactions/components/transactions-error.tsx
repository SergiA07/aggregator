import type { ErrorComponentProps } from '@tanstack/react-router';
import { RouteError } from '@/components/error/route-error';

export function TransactionsError({ error, reset }: ErrorComponentProps) {
  return (
    <RouteError
      error={error}
      reset={reset}
      pageName="transactions"
      retryLabel="Reload transactions"
    />
  );
}
