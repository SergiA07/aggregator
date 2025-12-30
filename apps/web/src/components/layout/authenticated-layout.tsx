import { Outlet, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { ImportModal } from '@/components/layout/import-modal';
import { useAuth } from '@/features/auth';
import { useTranslation } from '@/lib/i18n';
import { Header } from './header';
import { NavTab } from './nav-tab';
import { PageLayout } from './page-layout';

export function AuthenticatedLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      navigate({ to: '/login' });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('auth.signOutFailed');
      toast.error(message);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        user={user}
        onImportClick={() => setIsImportOpen(true)}
        onSignOut={handleSignOut}
        isSigningOut={isSigningOut}
      />

      <nav className="border-b border-border bg-card">
        <div className="w-full px-4 md:px-6 lg:px-8">
          <div className="flex gap-1">
            <NavTab to="/dashboard" label={t('nav.overview')} />
            <NavTab to="/positions" label={t('nav.positions')} />
            <NavTab to="/transactions" label={t('nav.transactions')} />
          </div>
        </div>
      </nav>

      <PageLayout>
        <Outlet />
      </PageLayout>

      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
    </div>
  );
}
