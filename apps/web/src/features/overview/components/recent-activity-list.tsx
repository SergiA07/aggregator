import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Coins, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import type { RecentActivity } from '@/lib/api/client';
import { useTranslation } from '@/lib/i18n';
import { formatCurrency, formatRelativeDate } from '@/utils/formatters';

interface RecentActivityListProps {
  activities: RecentActivity[];
  isLoading?: boolean;
  error?: Error | null;
}

export function RecentActivityList({ activities, isLoading, error }: RecentActivityListProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <Skeleton key={n} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{t('overview.activity.loadError')}</AlertDescription>
      </Alert>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <RefreshCw className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>{t('overview.activity.empty')}</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {activities.map((activity) => (
        <div key={activity.id} className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ActivityIcon type={activity.type} amount={activity.amount} />
            <div>
              <p className="font-medium">{activity.description}</p>
              <p className="text-sm text-muted-foreground">
                {activity.accountName}
                {activity.securitySymbol && <span> &middot; {activity.securitySymbol}</span>}
                <span className="ml-2">&middot; {formatRelativeDate(new Date(activity.date))}</span>
              </p>
            </div>
          </div>

          <p className={`font-medium ${activity.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {activity.amount >= 0 ? '+' : ''}
            {formatCurrency(activity.amount, activity.currency)}
          </p>
        </div>
      ))}
    </div>
  );
}

function ActivityIcon({ type, amount }: { type: string; amount: number }) {
  const isPositive = amount >= 0;

  switch (type) {
    case 'buy':
    case 'sell':
    case 'dividend':
      return (
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isPositive ? 'bg-green-500/10' : 'bg-red-500/10'
          }`}
        >
          {isPositive ? (
            <ArrowDownLeft className="h-4 w-4 text-green-500" />
          ) : (
            <ArrowUpRight className="h-4 w-4 text-red-500" />
          )}
        </div>
      );
    case 'deposit':
    case 'transfer_in':
    case 'interest':
      return (
        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
          <ArrowDownLeft className="h-4 w-4 text-green-500" />
        </div>
      );
    case 'withdrawal':
    case 'transfer_out':
    case 'fee':
      return (
        <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
          <ArrowUpRight className="h-4 w-4 text-red-500" />
        </div>
      );
    case 'fx_conversion':
      return (
        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
          <RefreshCw className="h-4 w-4 text-blue-500" />
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <Coins className="h-4 w-4 text-muted-foreground" />
        </div>
      );
  }
}
