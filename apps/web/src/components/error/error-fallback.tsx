import type { ErrorComponentProps } from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Default error fallback component for route errors.
 * Used by TanStack Router's defaultErrorComponent.
 *
 * @see https://tanstack.com/router/v1/docs/framework/react/api/router/errorComponentComponent
 */
export function ErrorFallback({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
      </div>

      <h1 className="mb-2 text-xl font-semibold">Something went wrong</h1>

      <p className="mb-6 max-w-md text-muted-foreground">
        {error instanceof Error ? error.message : 'An unexpected error occurred'}
      </p>

      <div className="flex gap-4">
        <Button onClick={reset}>Try again</Button>

        <a href="/dashboard">
          <Button variant="outline">Go to Dashboard</Button>
        </a>
      </div>

      {import.meta.env.DEV && error instanceof Error && error.stack && (
        <details className="mt-8 w-full max-w-2xl text-left">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Show error details
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-none bg-muted p-4 text-xs text-destructive">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
}
