import type { Position } from '@repo/shared-types';
import { useQuery } from '@tanstack/react-query';
import { PieChart } from 'lucide-react';
import { EmptyState } from '@/components/composed/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { positionListOptions } from '@/lib/api/queries/positions';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatters';

export function PositionsTable() {
  const { t } = useTranslation();
  const { data: positions, isLoading, error } = useQuery(positionListOptions());

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">{t('positions.error')}</p>
        </CardContent>
      </Card>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={PieChart}
            title={t('positions.empty.title')}
            description={t('positions.empty.description')}
          />
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totalValue = positions.reduce((sum, p) => sum + (p.marketValue || 0), 0);
  const totalCost = positions.reduce((sum, p) => sum + p.totalCost, 0);
  const totalPnl = positions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('positions.table.symbol')}</TableHead>
            <TableHead>{t('positions.table.name')}</TableHead>
            <TableHead className="text-right">{t('positions.table.quantity')}</TableHead>
            <TableHead className="text-right">{t('positions.table.avgCost')}</TableHead>
            <TableHead className="text-right">{t('positions.table.price')}</TableHead>
            <TableHead className="text-right">{t('positions.table.value')}</TableHead>
            <TableHead className="text-right">{t('positions.table.pnl')}</TableHead>
            <TableHead className="text-right">{t('positions.table.pnlPercent')}</TableHead>
            <TableHead>{t('positions.table.account')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((position: Position) => {
            const pnlPercent =
              position.totalCost > 0
                ? ((position.unrealizedPnl || 0) / position.totalCost) * 100
                : 0;
            const isPositive = (position.unrealizedPnl || 0) >= 0;

            return (
              <TableRow key={position.id}>
                <TableCell>
                  <span className="font-medium">{position.security?.symbol}</span>
                  {position.security?.isin && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {position.security.isin}
                    </span>
                  )}
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">
                  {position.security?.name}
                </TableCell>
                <TableCell className="text-right">{formatNumber(position.quantity, 4)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(position.avgCost, position.currency)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(position.marketPrice, position.currency)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(position.marketValue, position.currency)}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-medium',
                    isPositive ? 'text-green-500' : 'text-red-500',
                  )}
                >
                  {formatCurrency(position.unrealizedPnl, position.currency)}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-medium',
                    isPositive ? 'text-green-500' : 'text-red-500',
                  )}
                >
                  {formatPercent(pnlPercent)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{position.account?.broker}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={5}>{t('positions.table.total')}</TableCell>
            <TableCell className="text-right font-medium">{formatCurrency(totalValue)}</TableCell>
            <TableCell
              className={cn(
                'text-right font-medium',
                totalPnl >= 0 ? 'text-green-500' : 'text-red-500',
              )}
            >
              {formatCurrency(totalPnl)}
            </TableCell>
            <TableCell
              className={cn(
                'text-right font-medium',
                totalPnl >= 0 ? 'text-green-500' : 'text-red-500',
              )}
            >
              {formatPercent(totalCost > 0 ? (totalPnl / totalCost) * 100 : 0)}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </Card>
  );
}
