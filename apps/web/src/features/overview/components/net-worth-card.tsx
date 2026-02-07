import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/lib/i18n';
import { formatCurrency, formatPercent } from '@/utils/formatters';

interface NetWorthCardProps {
  netWorth: number;
  totalCash: number;
  totalInvested: number;
  cashPercentage: number;
  investedPercentage: number;
  ytdChangePercent: number;
  isLoading?: boolean;
}

export function NetWorthCard({
  netWorth,
  totalCash,
  totalInvested,
  cashPercentage,
  investedPercentage,
  ytdChangePercent,
  isLoading,
}: NetWorthCardProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="py-8">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-12 w-48 mb-4" />
          <div className="flex gap-8">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const ytdIsPositive = ytdChangePercent >= 0;

  return (
    <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
      <CardContent className="py-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{t('overview.netWorth.title')}</p>
            <p className="text-4xl font-bold text-primary">{formatCurrency(netWorth)}</p>
          </div>
          <div
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full ${
              ytdIsPositive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
            }`}
          >
            {ytdIsPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span className="font-semibold">YTD {formatPercent(ytdChangePercent)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">{t('overview.netWorth.cash')}: </span>
            <span className="font-medium">
              {formatCurrency(totalCash)} ({cashPercentage.toFixed(1)}%)
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('overview.netWorth.invested')}: </span>
            <span className="font-medium">
              {formatCurrency(totalInvested)} ({investedPercentage.toFixed(1)}%)
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
