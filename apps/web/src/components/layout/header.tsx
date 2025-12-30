import type { User } from '@supabase/supabase-js';
import { Upload } from 'lucide-react';
import { LanguagePicker } from '@/components/layout/language-picker';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';

interface HeaderProps {
  user: User | null;
  onImportClick: () => void;
  onSignOut: () => void;
  isSigningOut?: boolean;
}

export function Header({ user, onImportClick, onSignOut, isSigningOut }: HeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="bg-card border-b border-border">
      <div className="w-full px-4 md:px-6 lg:px-8 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-foreground">{t('common.appName')}</h1>
        <div className="flex items-center gap-4">
          <Button onClick={onImportClick}>
            <Upload className="size-4" />
            {t('header.import')}
          </Button>
          <span className="text-muted-foreground text-sm">{user?.email}</span>
          <LanguagePicker />
          <Button variant="outline" size="sm" onClick={onSignOut} disabled={isSigningOut}>
            {isSigningOut ? t('auth.signingOut') : t('auth.signOut')}
          </Button>
        </div>
      </div>
    </header>
  );
}
