import type { User } from '@supabase/supabase-js';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  user: User | null;
  onImportClick: () => void;
  onSignOut: () => void;
  isSigningOut?: boolean;
}

export function Header({ user, onImportClick, onSignOut, isSigningOut }: HeaderProps) {
  return (
    <header className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-foreground">Portfolio Aggregator</h1>
        <div className="flex items-center gap-4">
          <Button onClick={onImportClick}>
            <Upload className="size-4" />
            Import
          </Button>
          <span className="text-muted-foreground text-sm">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={onSignOut} disabled={isSigningOut}>
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </Button>
        </div>
      </div>
    </header>
  );
}
