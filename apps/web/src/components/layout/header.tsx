import type { User } from '@supabase/supabase-js';

interface HeaderProps {
  user: User | null;
  onImportClick: () => void;
  onSignOut: () => void;
  isSigningOut?: boolean;
}

export function Header({ user, onImportClick, onSignOut, isSigningOut }: HeaderProps) {
  return (
    <header className="bg-slate-800 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-white">Portfolio Aggregator</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onImportClick}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md transition-colors flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Import
          </button>
          <span className="text-slate-400">{user?.email}</span>
          <button
            type="button"
            onClick={onSignOut}
            disabled={isSigningOut}
            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-md transition-colors"
          >
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    </header>
  );
}
