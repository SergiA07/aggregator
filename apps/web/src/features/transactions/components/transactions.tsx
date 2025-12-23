import { TransactionsTable } from './transactions-table';

export function Transactions() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Transactions</h1>
      <TransactionsTable />
    </div>
  );
}
