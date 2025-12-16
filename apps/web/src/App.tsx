import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ImportModal, PositionsTable, TransactionsTable } from './components';
import { useAuth } from './hooks/useAuth';
import type { Account } from './lib/api';
import { api } from './lib/api';

const queryClient = new QueryClient();

type TabType = 'overview' | 'positions' | 'transactions';

function LoginForm() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="bg-slate-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Portfolio Aggregator</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md transition-colors"
          >
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full py-2 px-4 text-slate-400 hover:text-white transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isImportOpen, setIsImportOpen] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['positions-summary'],
    queryFn: api.getPositionsSummary,
  });

  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
  });

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">Portfolio Aggregator</h1>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
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
              onClick={signOut}
              className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1">
            {(['overview', 'positions', 'transactions'] as TabType[]).map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-primary-400 border-b-2 border-primary-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <SummaryCard
                title="Total Value"
                value={summaryLoading ? '...' : formatCurrency(summary?.totalValue ?? 0)}
                color="blue"
              />
              <SummaryCard
                title="Total Cost"
                value={summaryLoading ? '...' : formatCurrency(summary?.totalCost ?? 0)}
                color="slate"
              />
              <SummaryCard
                title="Total P&L"
                value={summaryLoading ? '...' : formatCurrency(summary?.totalPnl ?? 0)}
                color={(summary?.totalPnl ?? 0) >= 0 ? 'green' : 'red'}
              />
              <SummaryCard
                title="P&L %"
                value={
                  summaryLoading
                    ? '...'
                    : `${(summary?.pnlPercentage ?? 0) >= 0 ? '+' : ''}${(summary?.pnlPercentage ?? 0).toFixed(2)}%`
                }
                color={(summary?.pnlPercentage ?? 0) >= 0 ? 'green' : 'red'}
              />
            </div>

            {/* Accounts Section */}
            <section className="bg-slate-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Investment Accounts</h2>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
                >
                  + Add Account
                </button>
              </div>
              {accountsLoading ? (
                <p className="text-slate-400">Loading accounts...</p>
              ) : !accounts || accounts.length === 0 ? (
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
                    Import a CSV from your broker to get started
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsImportOpen(true)}
                    className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md transition-colors"
                  >
                    Import CSV
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {accounts.map((account: Account) => (
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
                          <p className="text-sm text-slate-400">
                            {account.accountName || 'Main Account'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-600 flex justify-between text-sm">
                        <span className="text-slate-400">Currency</span>
                        <span className="text-white">{account.currency}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Positions */}
              <section className="bg-slate-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Top Positions</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('positions')}
                    className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    View All
                  </button>
                </div>
                <PositionsTable />
              </section>

              {/* Recent Transactions */}
              <section className="bg-slate-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('transactions')}
                    className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    View All
                  </button>
                </div>
                <TransactionsTable limit={5} />
              </section>
            </div>
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">All Positions</h2>
              <div className="text-sm text-slate-400">
                {summary?.positionCount ?? 0} position
                {(summary?.positionCount ?? 0) !== 1 ? 's' : ''}
              </div>
            </div>
            <PositionsTable />
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">All Transactions</h2>
            </div>
            <TransactionsTable />
          </div>
        )}
      </main>

      {/* Import Modal */}
      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: 'blue' | 'green' | 'red' | 'slate';
}) {
  const colorClasses = {
    blue: 'bg-blue-900/50 border-blue-700',
    green: 'bg-green-900/50 border-green-700',
    red: 'bg-red-900/50 border-red-700',
    slate: 'bg-slate-800 border-slate-700',
  };

  return (
    <div className={`rounded-lg p-4 border ${colorClasses[color]}`}>
      <p className="text-sm text-slate-400">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Development mode: bypass authentication
  const isDev = import.meta.env.VITE_DEV_MODE === 'true';

  return (
    <QueryClientProvider client={queryClient}>
      {isDev || user ? <Dashboard /> : <LoginForm />}
    </QueryClientProvider>
  );
}

export default App;
