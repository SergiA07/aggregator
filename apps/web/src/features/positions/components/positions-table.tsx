import type { Position } from '@repo/shared-types';
import { useQuery } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, PieChart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DataTablePagination } from '@/components/composed/data-table-pagination';
import { EmptyState } from '@/components/composed/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { positionListOptions, positionSummaryOptions } from '@/lib/api/queries/positions';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatters';

const columnHelper = createColumnHelper<Position>();

export function PositionsTable() {
  const { t } = useTranslation();
  const { data: positions, isLoading, error } = useQuery(positionListOptions());
  // Use backend summary for totals - no frontend calculations
  const { data: summary } = useQuery(positionSummaryOptions());
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => row.security?.symbol, {
        id: 'symbol',
        header: ({ column }) => (
          <SortableHeader column={column}>{t('positions.table.symbol')}</SortableHeader>
        ),
        cell: (info) => (
          <div>
            <span className="font-medium">{info.getValue()}</span>
            {info.row.original.security?.isin && (
              <span className="ml-2 text-xs text-muted-foreground">
                {info.row.original.security.isin}
              </span>
            )}
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.security?.name, {
        id: 'name',
        header: ({ column }) => (
          <SortableHeader column={column}>{t('positions.table.name')}</SortableHeader>
        ),
        cell: (info) => (
          <span className="max-w-xs truncate text-muted-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('quantity', {
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            {t('positions.table.quantity')}
          </SortableHeader>
        ),
        cell: (info) => <div className="text-right">{formatNumber(info.getValue(), 4)}</div>,
      }),
      columnHelper.accessor('avgCost', {
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            {t('positions.table.avgCost')}
          </SortableHeader>
        ),
        cell: (info) => (
          <div className="text-right text-muted-foreground">
            {formatCurrency(info.getValue(), info.row.original.currency)}
          </div>
        ),
      }),
      columnHelper.accessor('marketPrice', {
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            {t('positions.table.price')}
          </SortableHeader>
        ),
        cell: (info) => {
          const source = info.row.original.source;
          return (
            <div className="flex items-center justify-end gap-1">
              <span className="text-muted-foreground">
                {formatCurrency(info.getValue(), info.row.original.currency)}
              </span>
              {source && <PriceSourceIndicator source={source} />}
            </div>
          );
        },
      }),
      columnHelper.accessor('marketValue', {
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            {t('positions.table.value')}
          </SortableHeader>
        ),
        cell: (info) => (
          <div className="text-right font-medium">
            {formatCurrency(info.getValue(), info.row.original.currency)}
          </div>
        ),
      }),
      columnHelper.accessor('unrealizedPnl', {
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            {t('positions.table.pnl')}
          </SortableHeader>
        ),
        cell: (info) => {
          const isPositive = (info.getValue() || 0) >= 0;
          return (
            <div
              className={cn(
                'text-right font-medium',
                isPositive ? 'text-green-500' : 'text-red-500',
              )}
            >
              {formatCurrency(info.getValue(), info.row.original.currency)}
            </div>
          );
        },
      }),
      columnHelper.accessor('unrealizedPnlPercent', {
        id: 'pnlPercent',
        header: ({ column }) => (
          <SortableHeader column={column} className="justify-end">
            {t('positions.table.pnlPercent')}
          </SortableHeader>
        ),
        cell: (info) => {
          const value = info.getValue() ?? 0;
          const isPositive = value >= 0;
          return (
            <div
              className={cn(
                'text-right font-medium',
                isPositive ? 'text-green-500' : 'text-red-500',
              )}
            >
              {formatPercent(value)}
            </div>
          );
        },
      }),
      columnHelper.accessor((row) => row.account?.institution, {
        id: 'account',
        header: ({ column }) => (
          <SortableHeader column={column}>{t('positions.table.account')}</SortableHeader>
        ),
        cell: (info) => <Badge variant="secondary">{info.getValue()}</Badge>,
      }),
    ],
    [t],
  );

  const table = useReactTable({
    data: positions ?? [],
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 30,
      },
    },
  });

  // Totals come from backend summary - no frontend calculations

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

  return (
    <Card>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {summary && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5}>{t('positions.table.total')}</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(summary.totalValue)}
              </TableCell>
              <TableCell
                className={cn(
                  'text-right font-medium',
                  summary.totalPnl >= 0 ? 'text-green-500' : 'text-red-500',
                )}
              >
                {formatCurrency(summary.totalPnl)}
              </TableCell>
              <TableCell
                className={cn(
                  'text-right font-medium',
                  summary.totalPnl >= 0 ? 'text-green-500' : 'text-red-500',
                )}
              >
                {formatPercent(summary.pnlPercentage)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        )}
      </Table>
      <DataTablePagination table={table} />
    </Card>
  );
}

interface SortableHeaderProps {
  column: {
    getIsSorted: () => false | 'asc' | 'desc';
    toggleSorting: (desc?: boolean) => void;
  };
  children: React.ReactNode;
  className?: string;
}

function SortableHeader({ column, children, className }: SortableHeaderProps) {
  const sorted = column.getIsSorted();

  return (
    <div className={cn('flex', className)}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 data-[state=open]:bg-accent"
        onClick={() => column.toggleSorting(sorted === 'asc')}
      >
        {children}
        {sorted === 'asc' ? (
          <ArrowUp className="ml-1.5 size-3.5" />
        ) : sorted === 'desc' ? (
          <ArrowDown className="ml-1.5 size-3.5" />
        ) : (
          <ArrowUpDown className="ml-1.5 size-3.5 opacity-50" />
        )}
      </Button>
    </div>
  );
}

/**
 * Small indicator showing the price data source
 * Color coding: green=finnhub (primary), blue=yahoo, purple=justetf, gray=cached
 */
function PriceSourceIndicator({ source }: { source: string }) {
  const colorMap: Record<string, string> = {
    finnhub: 'bg-green-500',
    yahoo: 'bg-blue-500',
    justetf: 'bg-purple-500',
    cached: 'bg-gray-400',
  };

  const labelMap: Record<string, string> = {
    finnhub: 'Finnhub',
    yahoo: 'Yahoo',
    justetf: 'justETF',
    cached: 'Cached',
  };

  return (
    <span
      className={cn('inline-block size-2 rounded-full', colorMap[source] || 'bg-gray-400')}
      title={`Price source: ${labelMap[source] || source}`}
    />
  );
}
