import type { ErrorComponentProps } from '@tanstack/react-router';

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
    <div className="bg-slate-800 rounded-lg p-8 text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-900/50 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-red-400"
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

      <h2 className="text-lg font-semibold text-white mb-2">Failed to load {pageName}</h2>

      <p className="text-slate-400 text-sm mb-4">
        {error instanceof Error ? error.message : 'An unexpected error occurred'}
      </p>

      <button
        type="button"
        onClick={reset}
        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors"
      >
        {retryLabel}
      </button>

      {import.meta.env.DEV && error instanceof Error && error.stack && (
        <details className="mt-6 text-left">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
            Error details
          </summary>
          <pre className="mt-2 p-3 bg-slate-900 rounded text-xs text-red-400 overflow-x-auto">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
}
