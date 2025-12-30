import { useTranslation } from '@/lib/i18n';
import { PositionsTable } from './positions-table';

export function Positions() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('positions.title')}</h1>
      <PositionsTable />
    </div>
  );
}
