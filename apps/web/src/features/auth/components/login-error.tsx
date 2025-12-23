import type { ErrorComponentProps } from '@tanstack/react-router';
import { RouteError } from '@/components/error/route-error';

export function LoginError({ error, reset }: ErrorComponentProps) {
  return <RouteError error={error} reset={reset} pageName="login" retryLabel="Try again" />;
}
