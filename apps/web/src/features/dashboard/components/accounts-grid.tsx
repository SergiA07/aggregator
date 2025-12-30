import type { Account } from '@repo/shared-types';
import { Inbox } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface AccountsGridProps {
  accounts: Account[] | undefined;
  isLoading: boolean;
}

export function AccountsGrid({ accounts, isLoading }: AccountsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-28" />
        ))}
      </div>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="text-center py-8">
        <Inbox className="size-12 mx-auto text-muted-foreground" />
        <p className="text-muted-foreground mt-2">No accounts yet</p>
        <p className="text-sm text-muted-foreground">
          Use the <span className="text-primary">Import</span> button in the header to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {accounts.map((account) => (
        <Card key={account.id} className="hover:bg-muted/50 transition-colors">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-sm">
                  {account.broker.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium capitalize">{account.broker.replace('-', ' ')}</p>
                <p className="text-sm text-muted-foreground">
                  {account.accountName || 'Main Account'}
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between text-sm">
            <span className="text-muted-foreground">Currency</span>
            <span>{account.currency}</span>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
