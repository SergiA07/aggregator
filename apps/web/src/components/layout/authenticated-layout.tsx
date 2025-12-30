import { Outlet, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ImportModal } from '@/components/composed/import-modal';
import { useAuth } from '@/features/auth';
import { Header } from './header';
import { NavTab } from './nav-tab';
import { PageLayout } from './page-layout';

export function AuthenticatedLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      navigate({ to: '/login' });
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
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            <NavTab to="/dashboard" label="Overview" />
            <NavTab to="/positions" label="Positions" />
            <NavTab to="/transactions" label="Transactions" />
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
