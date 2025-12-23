import type { ErrorComponentProps } from '@tanstack/react-router';

/**
 * Default error fallback component for route errors.
 * Used by TanStack Router's defaultErrorComponent.
 *
 * @see https://tanstack.com/router/v1/docs/framework/react/api/router/errorComponentComponent
 */
export function ErrorFallback({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
      <div className="w-16 h-16 mb-6 rounded-full bg-red-900/50 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h1 className="text-xl font-semibold text-white mb-2">Something went wrong</h1>

      <p className="text-slate-400 max-w-md mb-6">
        {error instanceof Error ? error.message : 'An unexpected error occurred'}
      </p>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md transition-colors"
        >
          Try again
        </button>

        <a
          href="/dashboard"
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-md transition-colors"
        >
          Go to Dashboard
        </a>
      </div>

      {import.meta.env.DEV && error instanceof Error && error.stack && (
        <details className="mt-8 text-left w-full max-w-2xl">
          <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-400">
            Show error details
          </summary>
          <pre className="mt-2 p-4 bg-slate-800 rounded-lg text-xs text-red-400 overflow-x-auto">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
}
