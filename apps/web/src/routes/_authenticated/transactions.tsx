import { createFileRoute } from '@tanstack/react-router';
import { Transactions, TransactionsError } from '@/features/transactions';

export const Route = createFileRoute('/_authenticated/transactions')({
  component: Transactions,
  errorComponent: TransactionsError,
});
