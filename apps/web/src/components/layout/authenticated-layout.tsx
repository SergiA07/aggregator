import { Outlet, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ImportModal } from '@/components/layout/import-modal';
import { useAuth } from '@/features/auth';
import { useTranslation } from '@/lib/i18n';
import { Header } from './header';
import { PageLayout } from './page-layout';
import { Sidebar } from './sidebar';

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
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        user={user}
        onImportClick={() => setIsImportOpen(true)}
        onSignOut={handleSignOut}
        isSigningOut={isSigningOut}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <Sidebar className="hidden md:flex" />

        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <PageLayout>
            <Outlet />
          </PageLayout>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />

      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
    </div>
  );
}
