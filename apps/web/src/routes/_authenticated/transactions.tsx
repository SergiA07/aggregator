import { createFileRoute } from '@tanstack/react-router';
import { Transactions, TransactionsError } from '@/features/transactions';
import { transactionListOptions } from '@/lib/api/queries/transactions';

export const Route = createFileRoute('/_authenticated/transactions')({
  loader: async ({ context: { queryClient } }) => {
    // Prefetch transactions (no price update needed)
    await queryClient.ensureQueryData(transactionListOptions());
  },
  component: Transactions,
  errorComponent: TransactionsError,
});
