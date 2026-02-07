import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PositionsTable } from '@/features/positions/components/positions-table';
import { useTranslation } from '@/lib/i18n';
import { BrokerAccountsTab } from './broker-accounts-tab';

export function Investments() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('investments.title')}</h1>

      <Tabs defaultValue="positions" className="w-full">
        <TabsList>
          <TabsTrigger value="positions">{t('investments.tabs.positions')}</TabsTrigger>
          <TabsTrigger value="accounts">{t('investments.tabs.accounts')}</TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="mt-6">
          <PositionsTable />
        </TabsContent>

        <TabsContent value="accounts" className="mt-6">
          <BrokerAccountsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
