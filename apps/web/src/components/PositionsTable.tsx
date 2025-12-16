import { useQuery } from '@tanstack/react-query';
import type { Position } from '../lib/api';
import { api } from '../lib/api';

function formatCurrency(value: number | undefined | null, currency = 'EUR'): string {
  if (value === undefined || value === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null) return '-';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function PositionsTable() {
  const {
    data: positions,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['positions'],
    queryFn: api.getPositions,
  });

  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <p className="text-slate-400">Loading positions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <p className="text-red-400">Error loading positions</p>
      </div>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <p className="text-slate-400">No positions yet. Import CSV data to get started.</p>
      </div>
    );
  }

  // Calculate totals
  const totalValue = positions.reduce((sum, p) => sum + (p.marketValue || 0), 0);
  const totalCost = positions.reduce((sum, p) => sum + p.totalCost, 0);
  const totalPnl = positions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-700/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Symbol</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Name</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Qty</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Avg Cost</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Price</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Value</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">P&L</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">P&L %</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Account</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {positions.map((position: Position) => {
              const pnlPercent =
                position.totalCost > 0
                  ? ((position.unrealizedPnl || 0) / position.totalCost) * 100
                  : 0;
              const pnlColor =
                (position.unrealizedPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400';

              return (
                <tr key={position.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-white">{position.security.symbol}</span>
                    {position.security.isin && (
                      <span className="ml-2 text-xs text-slate-500">{position.security.isin}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300 max-w-xs truncate">
                    {position.security.name}
                  </td>
                  <td className="px-4 py-3 text-right text-white">
                    {formatNumber(position.quantity, 4)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300">
                    {formatCurrency(position.avgCost, position.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300">
                    {formatCurrency(position.marketPrice, position.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-white font-medium">
                    {formatCurrency(position.marketValue, position.currency)}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${pnlColor}`}>
                    {formatCurrency(position.unrealizedPnl, position.currency)}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${pnlColor}`}>
                    {formatPercent(pnlPercent)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
                      {position.account.broker}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-700/50 font-medium">
              <td colSpan={5} className="px-4 py-3 text-slate-300">
                Total
              </td>
              <td className="px-4 py-3 text-right text-white">{formatCurrency(totalValue)}</td>
              <td
                className={`px-4 py-3 text-right ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}
              >
                {formatCurrency(totalPnl)}
              </td>
              <td
                className={`px-4 py-3 text-right ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}
              >
                {formatPercent(totalCost > 0 ? (totalPnl / totalCost) * 100 : 0)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
