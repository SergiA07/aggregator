import { useQuery } from '@tanstack/react-query';
import { accountListOptions } from '@/lib/api/queries/accounts';
import { positionSummaryOptions } from '@/lib/api/queries/positions';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { AccountsGrid } from './accounts-grid';
import { SummaryCard } from './summary-card';

export function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useQuery(positionSummaryOptions());
  const { data: accounts, isLoading: accountsLoading } = useQuery(accountListOptions());

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {summaryLoading ? (
          [1, 2, 3, 4].map((n) => (
            <div key={`skeleton-${n}`} className="animate-pulse bg-slate-800 rounded-lg p-4 h-24" />
          ))
        ) : (
          <>
            <SummaryCard
              title="Total Value"
              value={formatCurrency(summary?.totalValue ?? 0)}
              color="blue"
            />
            <SummaryCard
              title="Total Cost"
              value={formatCurrency(summary?.totalCost ?? 0)}
              color="slate"
            />
            <SummaryCard
              title="Total P&L"
              value={formatCurrency(summary?.totalPnl ?? 0)}
              color={summary?.totalPnl && summary.totalPnl >= 0 ? 'green' : 'red'}
            />
            <SummaryCard
              title="Return"
              value={formatPercent(summary?.pnlPercentage ?? 0)}
              color={summary?.pnlPercentage && summary.pnlPercentage >= 0 ? 'green' : 'red'}
            />
          </>
        )}
      </div>

      {/* Accounts Section */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Investment Accounts</h2>
        <AccountsGrid accounts={accounts} isLoading={accountsLoading} />
      </section>
    </div>
  );
}
