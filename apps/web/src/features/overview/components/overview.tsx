import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Landmark, PiggyBank, TrendingUp, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { overviewSummaryOptions, recentActivityOptions } from '@/lib/api/queries/overview';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import { getInstitutionColor, getInstitutionDisplayName } from '../config/institutions';
import { AccountsList } from './accounts-list';
import { AllocationChart } from './allocation-chart';
import { NetWorthCard } from './net-worth-card';
import { RecentActivityList } from './recent-activity-list';

export function Overview() {
  const { t } = useTranslation();
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery(overviewSummaryOptions());
  const {
    data: activity,
    isLoading: activityLoading,
    error: activityError,
  } = useQuery(recentActivityOptions(10));

  // Build color map for institutions using display names as keys
  const institutionColorMap = useMemo(() => {
    if (!summary?.byInstitution) return new Map<string, string>();
    const colorMap = new Map<string, string>();
    for (const item of summary.byInstitution) {
      const displayName = getInstitutionDisplayName(item.institution);
      colorMap.set(displayName, getInstitutionColor(item.institution));
    }
    return colorMap;
  }, [summary?.byInstitution]);

  if (summaryError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{t('overview.loadError')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Net Worth Hero Card */}
      <NetWorthCard
        netWorth={summary?.netWorth ?? 0}
        totalCash={summary?.totalCash ?? 0}
        totalInvested={summary?.totalInvested ?? 0}
        cashPercentage={summary?.cashPercentage ?? 0}
        investedPercentage={summary?.investedPercentage ?? 0}
        ytdChangePercent={summary?.totalYtdChangePercent ?? 0}
        isLoading={summaryLoading}
      />

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          title={t('overview.stats.cash')}
          value={formatCurrency(summary?.totalCash ?? 0)}
          isLoading={summaryLoading}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          title={t('overview.stats.invested')}
          value={formatCurrency(summary?.totalInvested ?? 0)}
          isLoading={summaryLoading}
        />
        <StatCard
          icon={<PiggyBank className="h-4 w-4" />}
          title={t('overview.stats.ytdChange')}
          value={formatCurrency(summary?.totalYtdChange ?? 0)}
          variant={
            summary?.totalYtdChange && summary.totalYtdChange >= 0 ? 'success' : 'destructive'
          }
          isLoading={summaryLoading}
        />
        <StatCard
          icon={<Landmark className="h-4 w-4" />}
          title={t('overview.stats.accounts')}
          value={String(summary?.byType.reduce((sum, t) => sum + t.accountCount, 0) ?? 0)}
          isLoading={summaryLoading}
        />
      </div>

      {/* Two Column Layout: Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocation by Type */}
        <Card>
          <CardHeader>
            <CardTitle>{t('overview.allocation.byType')}</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-[200px]" />
            ) : (
              <AllocationChart
                data={
                  summary?.byType.map((item) => ({
                    name: t(
                      `overview.accountType.${item.type}` as
                        | 'overview.accountType.broker'
                        | 'overview.accountType.bank'
                        | 'overview.accountType.pension'
                        | 'overview.accountType.crypto'
                        | 'overview.accountType.real_estate'
                        | 'overview.accountType.other',
                    ),
                    value: item.totalValue,
                    percentage: item.percentage,
                  })) ?? []
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Allocation by Institution */}
        <Card>
          <CardHeader>
            <CardTitle>{t('overview.allocation.byInstitution')}</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-[200px]" />
            ) : (
              <AllocationChart
                data={
                  summary?.byInstitution.map((item) => ({
                    name: getInstitutionDisplayName(item.institution),
                    value: item.totalValue,
                    percentage: item.percentage,
                  })) ?? []
                }
                colorMap={institutionColorMap}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accounts List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('overview.accounts.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountsList />
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>{t('overview.activity.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentActivityList
            activities={activity ?? []}
            isLoading={activityLoading}
            error={activityError}
          />
        </CardContent>
      </Card>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  variant?: 'default' | 'success' | 'destructive';
  isLoading?: boolean;
}

function StatCard({ icon, title, value, variant = 'default', isLoading }: StatCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-sm">{title}</span>
        </div>
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
