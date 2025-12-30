import type { Transaction } from '@repo/shared-types';
import { useQuery } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/composed/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { transactionListOptions } from '@/lib/api/queries/transactions';
import { useTranslation } from '@/lib/i18n';
import { formatCurrency, formatDate } from '@/utils/formatters';

type TransactionType = 'buy' | 'sell' | 'dividend' | 'fee' | 'split' | 'other';

const TYPE_VARIANTS: Record<TransactionType, 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    buy: 'default',
    sell: 'destructive',
    dividend: 'secondary',
    fee: 'outline',
    split: 'outline',
    other: 'secondary',
  };

interface TransactionsTableProps {
  accountId?: string;
  limit?: number;
}

export function TransactionsTable({ accountId, limit }: TransactionsTableProps) {
  const { t } = useTranslation();
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const {
    data: transactions,
    isLoading,
    error,
  } = useQuery(
    transactionListOptions({
      accountId,
      type: typeFilter === 'all' ? undefined : typeFilter,
    }),
  );

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
          <p className="text-destructive">{t('transactions.error')}</p>
        </CardContent>
      </Card>
    );
  }

  const displayedTransactions = limit ? transactions?.slice(0, limit) : transactions;

  if (!displayedTransactions || displayedTransactions.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={Receipt}
            title={t('transactions.empty.title')}
            description={t('transactions.empty.description')}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {/* Filters */}
      <div className="p-4 border-b border-border flex items-center gap-4">
        <Label htmlFor="type-filter">{t('transactions.filterByType')}</Label>
        <Select value={typeFilter} onValueChange={(value) => value && setTypeFilter(value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="buy">{t('transactions.types.buy')}</SelectItem>
            <SelectItem value="sell">{t('transactions.types.sell')}</SelectItem>
            <SelectItem value="dividend">{t('transactions.types.dividend')}</SelectItem>
            <SelectItem value="fee">{t('transactions.types.fee')}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {t('transactions.count', { count: displayedTransactions.length })}
          {limit &&
            transactions &&
            transactions.length > limit &&
            ` ${t('transactions.showing', { shown: limit, total: transactions.length })}`}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('transactions.table.date')}</TableHead>
            <TableHead>{t('transactions.table.type')}</TableHead>
            <TableHead>{t('transactions.table.symbol')}</TableHead>
            <TableHead>{t('transactions.table.name')}</TableHead>
            <TableHead className="text-right">{t('transactions.table.quantity')}</TableHead>
            <TableHead className="text-right">{t('transactions.table.price')}</TableHead>
            <TableHead className="text-right">{t('transactions.table.amount')}</TableHead>
            <TableHead className="text-right">{t('transactions.table.fees')}</TableHead>
            <TableHead>{t('transactions.table.account')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayedTransactions.map((tx: Transaction) => (
            <TableRow key={tx.id}>
              <TableCell className="whitespace-nowrap">{formatDate(tx.date)}</TableCell>
              <TableCell>
                <Badge variant={TYPE_VARIANTS[tx.type as TransactionType] ?? 'secondary'}>
                  {t(`transactions.types.${tx.type as TransactionType}`)}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="font-medium">{tx.security?.symbol}</span>
              </TableCell>
              <TableCell className="max-w-xs truncate text-muted-foreground">
                {tx.security?.name}
              </TableCell>
              <TableCell className="text-right">
                {tx.quantity.toLocaleString('en-US', { maximumFractionDigits: 4 })}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCurrency(tx.price, tx.currency)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(tx.amount, tx.currency)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {tx.fees > 0 ? formatCurrency(tx.fees, tx.currency) : '-'}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{tx.account?.broker}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
