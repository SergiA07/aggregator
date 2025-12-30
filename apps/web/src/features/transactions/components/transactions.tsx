import { useTranslation } from '@/lib/i18n';
import { TransactionsTable } from './transactions-table';

export function Transactions() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('transactions.title')}</h1>
      <TransactionsTable />
    </div>
  );
}
