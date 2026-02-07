import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  FileSpreadsheet,
  MoreVertical,
  PencilLine,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import type { AccountSummary } from '@/lib/api/client';
import { overviewAccountsOptions } from '@/lib/api/queries/overview';
import { useTranslation } from '@/lib/i18n';
import { formatCurrency, formatPercent, formatRelativeDate } from '@/utils/formatters';
import {
  getAccountTypeSortOrder,
  getInstitutionColor,
  getInstitutionDisplayName,
} from '../config/institutions';
import { AddValuationModal } from './add-valuation-modal';

// Account types that use manual valuations for last update date (excludes 'other' like cash)
const VALUATION_ACCOUNT_TYPES = ['pension', 'real_estate'];

/**
 * Get a clean display name for an account
 * - For brokers/banks: Use institution name (e.g., "DeGiro", "Interactive Brokers")
 * - For pension: "Name - Institution" (e.g., "Pla de pensions - Caser")
 * - For other: Just the name (e.g., "Efectiu")
 */
function getAccountDisplayName(account: AccountSummary): string {
  const institutionDisplay = getInstitutionDisplayName(account.institution ?? '');

  if (account.type === 'pension') {
    return `${account.name} - ${institutionDisplay}`;
  }

  if (account.type === 'other') {
    return account.name;
  }

  // For broker/bank accounts, use the institution name as the primary display
  return institutionDisplay;
}

export function AccountsList() {
  const { t } = useTranslation();
  const { data: accounts, isLoading, error } = useQuery(overviewAccountsOptions());
  const [valuationAccount, setValuationAccount] = useState<AccountSummary | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{t('overview.accounts.loadError')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      {!accounts || accounts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>{t('overview.accounts.empty')}</p>
        </div>
      ) : (
        <div className="divide-y">
          {[...accounts]
            .sort((a, b) => getAccountTypeSortOrder(a.type) - getAccountTypeSortOrder(b.type))
            .map((account) => {
              const isValuationAccount = VALUATION_ACCOUNT_TYPES.includes(account.type);
              const hasYtdData =
                account.ytdChangePercent !== undefined && account.ytdChangePercent !== null;

              // Format display name: combine name and institution nicely
              const displayName = getAccountDisplayName(account);

              // Get last update date
              const lastUpdate = isValuationAccount
                ? account.lastValuationAt
                : account.lastImportAt;

              return (
                <div key={account.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: getInstitutionColor(account.institution ?? '') }}
                      />
                      <span className="text-sm font-medium truncate">{displayName}</span>
                      {!account.isActive && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {t('overview.accounts.inactive')}
                        </Badge>
                      )}
                    </div>
                    {lastUpdate && (
                      <p className="text-xs text-muted-foreground ml-4">
                        {t('overview.accounts.lastUpdate')}{' '}
                        {formatRelativeDate(new Date(lastUpdate))}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {/* Value and Performance */}
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(account.totalValue)}</p>

                      {/* Show YTD % for accounts that have YTD data (brokers and valuation accounts) */}
                      {hasYtdData && (
                        <p
                          className={`text-sm flex items-center justify-end gap-1 ${
                            account.ytdChangePercent! >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}
                        >
                          {account.ytdChangePercent! >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span>YTD {formatPercent(account.ytdChangePercent!)}</span>
                        </p>
                      )}
                    </div>

                    {/* Account Actions Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent hover:text-accent-foreground"
                        aria-label={t('common.more')}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-auto">
                        {/* Manual balance update - for banks, pension, and other */}
                        {(account.type === 'bank' ||
                          account.type === 'pension' ||
                          account.type === 'other') && (
                          <DropdownMenuItem onClick={() => setValuationAccount(account)}>
                            <PencilLine className="h-4 w-4" />
                            {t('overview.accounts.updateBalance')}
                          </DropdownMenuItem>
                        )}
                        {/* CSV import - for brokers and banks */}
                        {(account.type === 'broker' || account.type === 'bank') && (
                          <DropdownMenuItem
                            onClick={() => {
                              // TODO: Open import modal with account pre-selected
                            }}
                          >
                            <FileSpreadsheet className="h-4 w-4" />
                            {t('overview.accounts.importCSV')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Valuation Modal */}
      <AddValuationModal
        isOpen={!!valuationAccount}
        onClose={() => setValuationAccount(null)}
        account={valuationAccount}
      />
    </>
  );
}
