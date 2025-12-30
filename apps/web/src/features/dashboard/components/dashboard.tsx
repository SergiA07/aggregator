import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { accountListOptions } from '@/lib/api/queries/accounts';
import { positionSummaryOptions } from '@/lib/api/queries/positions';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { AccountsGrid } from './accounts-grid';
import { SummaryCard } from './summary-card';

export function Dashboard() {
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery(positionSummaryOptions());
  const {
    data: accounts,
    isLoading: accountsLoading,
    error: accountsError,
  } = useQuery(accountListOptions());

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {summaryLoading ? (
          [1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-24" />)
        ) : summaryError ? (
          <Alert variant="destructive" className="col-span-full">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load portfolio summary. Please try refreshing the page.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <SummaryCard
              title="Total Value"
              value={formatCurrency(summary?.totalValue ?? 0)}
              variant="info"
            />
            <SummaryCard title="Total Cost" value={formatCurrency(summary?.totalCost ?? 0)} />
            <SummaryCard
              title="Total P&L"
              value={formatCurrency(summary?.totalPnl ?? 0)}
              variant={summary?.totalPnl && summary.totalPnl >= 0 ? 'success' : 'destructive'}
            />
            <SummaryCard
              title="Return"
              value={formatPercent(summary?.pnlPercentage ?? 0)}
              variant={
                summary?.pnlPercentage && summary.pnlPercentage >= 0 ? 'success' : 'destructive'
              }
            />
          </>
        )}
      </div>

      {/* Accounts Section */}
      <Card>
        <CardHeader>
          <CardTitle>Investment Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountsGrid accounts={accounts} isLoading={accountsLoading} error={accountsError} />
        </CardContent>
      </Card>
    </div>
  );
}
