import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';

interface InvestmentsErrorProps {
  error: Error;
  reset?: () => void;
}

export function InvestmentsError({ error, reset }: InvestmentsErrorProps) {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto py-8">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t('errors.unexpected')}</AlertTitle>
        <AlertDescription className="mt-2">
          <p>{error.message || t('errors.generic')}</p>
          {reset && (
            <Button variant="outline" size="sm" onClick={reset} className="mt-4">
              {t('common.tryAgain')}
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
