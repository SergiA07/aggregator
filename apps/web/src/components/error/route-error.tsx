import type { ErrorComponentProps } from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface RouteErrorProps extends ErrorComponentProps {
  /** The name of the page/feature that failed */
  pageName: string;
  /** Optional retry action label */
  retryLabel?: string;
}

/**
 * Reusable error component for individual routes.
 * Provides context-specific error messages while keeping consistent styling.
 */
export function RouteError({ error, reset, pageName, retryLabel = 'Try again' }: RouteErrorProps) {
  return (
    <Card className="p-8 text-center">
      <CardContent className="p-0">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
        </div>

        <h2 className="mb-2 text-lg font-semibold">Failed to load {pageName}</h2>

        <p className="mb-4 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </p>

        <Button onClick={reset}>{retryLabel}</Button>

        {import.meta.env.DEV && error instanceof Error && error.stack && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Error details
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-none bg-muted p-3 text-xs text-destructive">
              {error.stack}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
