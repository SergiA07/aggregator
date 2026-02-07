import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getInstitutionColor,
  getInstitutionDisplayName,
} from '@/features/overview/config/institutions';
import type { AccountSummary } from '@/lib/api/client';
import {
  overviewAccountsOptions,
  overviewSummaryOptions,
  type PerformancePeriod,
} from '@/lib/api/queries/overview';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent, formatRelativeDate } from '@/utils/formatters';

/**
 * Period options for the filter buttons
 */
const PERIOD_OPTIONS: { value: PerformancePeriod; label: string }[] = [
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: 'ytd', label: 'YTD' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
];

/**
 * BrokerAccountsTab - Shows broker accounts with performance in the Investments view
 *
 * Displays:
 * - Period filter buttons (1D, 1W, 1M, 3M, YTD, 1Y, All)
 * - Summary totals (total invested, period change)
 * - List of broker accounts with their performance
 */
export function BrokerAccountsTab() {
  const { t } = useTranslation();
  const [selectedPeriod, setSelectedPeriod] = useState<PerformancePeriod>('ytd');

  const { data: accounts, isLoading, error } = useQuery(overviewAccountsOptions(selectedPeriod));
  // Use overview summary for consistent totals from backend
  const { data: overviewSummary } = useQuery(overviewSummaryOptions());

  // Filter to only broker accounts for display
  const brokerAccounts = accounts?.filter((a) => a.type === 'broker') ?? [];

  // Get broker totals from backend summary (byType breakdown)
  const brokerTypeData = overviewSummary?.byType.find((t) => t.type === 'broker');
  const brokerTotals = {
    totalInvested: brokerTypeData?.investedValue ?? 0,
    totalUnrealizedPnl: overviewSummary?.totalUnrealizedPnl ?? 0,
    totalPeriodChange: overviewSummary?.totalYtdChange ?? 0,
  };

  // Use backend-calculated YTD percentage
  const totalPeriodChangePercent = overviewSummary?.totalYtdChangePercent ?? 0;

  // Get display label for the selected period
  const periodLabel =
    selectedPeriod === 'all'
      ? t('investments.accounts.allTime')
      : (PERIOD_OPTIONS.find((p) => p.value === selectedPeriod)?.label ?? 'YTD');

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{t('investments.accounts.loadError')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={selectedPeriod === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPeriod(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label={t('investments.accounts.totalInvested')}
          value={formatCurrency(brokerTotals.totalInvested)}
          isLoading={isLoading}
        />
        <SummaryCard
          label={t('investments.accounts.unrealizedPnl')}
          value={formatCurrency(brokerTotals.totalUnrealizedPnl)}
          variant={brokerTotals.totalUnrealizedPnl >= 0 ? 'success' : 'destructive'}
          isLoading={isLoading}
        />
        <SummaryCard
          label={`${periodLabel} ${t('investments.accounts.change')}`}
          value={formatCurrency(brokerTotals.totalPeriodChange)}
          variant={brokerTotals.totalPeriodChange >= 0 ? 'success' : 'destructive'}
          isLoading={isLoading}
        />
        <SummaryCard
          label={`${periodLabel} %`}
          value={formatPercent(totalPeriodChangePercent)}
          variant={totalPeriodChangePercent >= 0 ? 'success' : 'destructive'}
          isLoading={isLoading}
        />
      </div>

      {/* Broker Accounts List */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} className="h-16 w-full" />
              ))}
            </div>
          ) : brokerAccounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t('investments.accounts.empty')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {brokerAccounts.map((account) => (
                <BrokerAccountRow key={account.id} account={account} periodLabel={periodLabel} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  variant?: 'default' | 'success' | 'destructive';
  isLoading?: boolean;
}

function SummaryCard({ label, value, variant = 'default', isLoading }: SummaryCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-7 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p
          className={cn(
            'text-xl font-bold',
            variant === 'success' && 'text-green-500',
            variant === 'destructive' && 'text-red-500',
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

interface BrokerAccountRowProps {
  account: AccountSummary;
  periodLabel: string;
}

function BrokerAccountRow({ account, periodLabel }: BrokerAccountRowProps) {
  const { t } = useTranslation();
  const displayName = getInstitutionDisplayName(account.institution);
  const hasPeriodData = account.ytdChangePercent !== undefined && account.ytdChangePercent !== null;

  return (
    <div className="py-4 flex items-center justify-between gap-4">
      {/* Account Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: getInstitutionColor(account.institution) }}
          />
          <span className="font-medium truncate">{displayName}</span>
        </div>
        {account.lastImportAt && (
          <p className="text-xs text-muted-foreground ml-5">
            {t('investments.accounts.lastUpdate')}{' '}
            {formatRelativeDate(new Date(account.lastImportAt))}
          </p>
        )}
      </div>

      {/* Value Column */}
      <div className="text-right shrink-0">
        <p className="font-medium">{formatCurrency(account.investedValue)}</p>
        <p className="text-xs text-muted-foreground">
          {t('investments.accounts.totalValue')}: {formatCurrency(account.totalValue)}
        </p>
      </div>

      {/* Unrealized P&L Column */}
      <div className="text-right shrink-0 min-w-[100px]">
        <p
          className={cn(
            'font-medium',
            account.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500',
          )}
        >
          {formatCurrency(account.unrealizedPnl)}
        </p>
        {account.unrealizedPnlPercent !== null && (
          <p
            className={cn(
              'text-xs',
              account.unrealizedPnlPercent >= 0 ? 'text-green-500' : 'text-red-500',
            )}
          >
            {formatPercent(account.unrealizedPnlPercent)}
          </p>
        )}
      </div>

      {/* Period Performance Column */}
      <div className="text-right shrink-0 min-w-[100px]">
        {hasPeriodData ? (
          <>
            <p
              className={cn(
                'font-medium flex items-center justify-end gap-1',
                account.ytdChangePercent! >= 0 ? 'text-green-500' : 'text-red-500',
              )}
            >
              {account.ytdChangePercent! >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {formatPercent(account.ytdChangePercent!)}
            </p>
            <p className="text-xs text-muted-foreground">
              {periodLabel}: {formatCurrency(account.ytdChange ?? 0)}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">-</p>
        )}
      </div>
    </div>
  );
}
