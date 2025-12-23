import type { Transaction } from '@repo/shared-types';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { transactionListOptions } from '@/lib/api/queries/transactions';
import { formatCurrency, formatDate } from '@/utils/formatters';

const TYPE_COLORS: Record<string, string> = {
  buy: 'bg-green-900/50 text-green-400',
  sell: 'bg-red-900/50 text-red-400',
  dividend: 'bg-blue-900/50 text-blue-400',
  fee: 'bg-yellow-900/50 text-yellow-400',
  split: 'bg-purple-900/50 text-purple-400',
  other: 'bg-slate-700 text-slate-400',
};

interface TransactionsTableProps {
  accountId?: string;
  limit?: number;
}

export function TransactionsTable({ accountId, limit }: TransactionsTableProps) {
  const [typeFilter, setTypeFilter] = useState<string>('');

  const {
    data: transactions,
    isLoading,
    error,
  } = useQuery(
    transactionListOptions({
      accountId,
      type: typeFilter || undefined,
    }),
  );

  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <p className="text-slate-400">Loading transactions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <p className="text-red-400">Error loading transactions</p>
      </div>
    );
  }

  const displayedTransactions = limit ? transactions?.slice(0, limit) : transactions;

  if (!displayedTransactions || displayedTransactions.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <p className="text-slate-400">No transactions yet. Import CSV data to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      {/* Filters */}
      <div className="p-4 border-b border-slate-700 flex items-center gap-4">
        <label htmlFor="type-filter" className="text-sm text-slate-400">
          Filter by type:
        </label>
        <select
          id="type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All</option>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
          <option value="dividend">Dividend</option>
          <option value="fee">Fee</option>
        </select>
        <span className="text-sm text-slate-500">
          {displayedTransactions.length} transaction{displayedTransactions.length !== 1 ? 's' : ''}
          {limit &&
            transactions &&
            transactions.length > limit &&
            ` (showing ${limit} of ${transactions.length})`}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-700/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Symbol</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Name</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Qty</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Price</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Amount</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Fees</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Account</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {displayedTransactions.map((tx: Transaction) => (
              <tr key={tx.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                  {formatDate(tx.date)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium uppercase ${TYPE_COLORS[tx.type] || TYPE_COLORS.other}`}
                  >
                    {tx.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-white">{tx.security?.symbol}</span>
                </td>
                <td className="px-4 py-3 text-slate-300 max-w-xs truncate">{tx.security?.name}</td>
                <td className="px-4 py-3 text-right text-white">
                  {tx.quantity.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                </td>
                <td className="px-4 py-3 text-right text-slate-300">
                  {formatCurrency(tx.price, tx.currency)}
                </td>
                <td className="px-4 py-3 text-right text-white font-medium">
                  {formatCurrency(tx.amount, tx.currency)}
                </td>
                <td className="px-4 py-3 text-right text-slate-400">
                  {tx.fees > 0 ? formatCurrency(tx.fees, tx.currency) : '-'}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
                    {tx.account?.broker}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
