import type { Account } from '@repo/shared-types';

interface AccountsGridProps {
  accounts: Account[] | undefined;
  isLoading: boolean;
}

export function AccountsGrid({ accounts, isLoading }: AccountsGridProps) {
  if (isLoading) {
    return <p className="text-slate-400">Loading accounts...</p>;
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="w-12 h-12 mx-auto text-slate-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <p className="text-slate-400 mt-2">No accounts yet</p>
        <p className="text-sm text-slate-500">
          Use the <span className="text-primary-400">Import CSV</span> button in the header to get
          started
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {accounts.map((account) => (
        <div
          key={account.id}
          className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-600/20 flex items-center justify-center">
              <span className="text-primary-400 font-bold text-sm">
                {account.broker.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-white capitalize">
                {account.broker.replace('-', ' ')}
              </p>
              <p className="text-sm text-slate-400">{account.accountName || 'Main Account'}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-600 flex justify-between text-sm">
            <span className="text-slate-400">Currency</span>
            <span className="text-white">{account.currency}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
