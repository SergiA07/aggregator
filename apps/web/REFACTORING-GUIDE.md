# Web App Refactoring Guide - Learning Exercise

This is a step-by-step guide to refactor `apps/web` to follow the documented architecture in `.claude/rules/web-architecture.md`. Work through each step at your own pace. Check off tasks as you complete them.

---

## Current State (What We're Fixing)

| Issue | Current | Target |
|-------|---------|--------|
| Navigation | `useState` for tabs | TanStack Router with URLs |
| Structure | Flat `components/` folder | Feature-first (`features/`) |
| App.tsx | 383 lines, everything inline | Split into routes + features |
| Imports | Relative (`../lib/api`) | Path aliases (`@/lib/api`) |
| Formatters | Duplicated in 3 files | Shared in `lib/utils.ts` |
| Testing | None | Vitest + MSW |

---

## Prerequisites

Before starting, make sure you understand:
- [TanStack Router docs](https://tanstack.com/router/latest/docs/framework/react/overview)
- [TanStack Query docs](https://tanstack.com/query/latest/docs/framework/react/overview)
- Feature-based folder structure (read `.claude/rules/web-architecture.md`)

---

## Phase 1: Setup Infrastructure

### Step 1.1: Install Dependencies

```bash
cd apps/web

# Runtime dependencies
bun add @tanstack/react-router @tanstack/react-router-devtools sonner clsx tailwind-merge

# Dev dependencies for testing
bun add -D vitest @testing-library/react @testing-library/dom @testing-library/jest-dom happy-dom msw @vitejs/plugin-react
```

**What these do:**
- `@tanstack/react-router` - File-based routing with type safety
- `sonner` - Toast notifications for errors/success
- `clsx` + `tailwind-merge` - Utility for merging Tailwind classes
- `vitest` + `@testing-library/*` - Testing framework
- `msw` - Mock Service Worker for API mocking in tests

---

### Step 1.2: Add Path Aliases

Path aliases let you import with `@/lib/api` instead of `../../../lib/api`.

**Edit `apps/web/tsconfig.app.json`:**

```json
{
  "extends": "@repo/config/typescript/react",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "types": ["vite/client"],
    "erasableSyntaxOnly": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

**Edit `apps/web/vite.config.ts`** - Add the resolve section:

```typescript
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Add this resolve section
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },

  // ... rest of your config stays the same
  envDir: '../../',
  plugins: [
    // ...
  ],
  // ...
});
```

**Test it works:**
After this change, try importing something with `@/` in any file. TypeScript should recognize it.

---

### Step 1.3: Create Shared Utilities

Create `apps/web/src/lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes safely (handles conflicts like "p-2 p-4" → "p-4")
 * Usage: cn('p-2', condition && 'text-red-500', 'font-bold')
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as currency
 * @param value - Number to format
 * @param currency - Currency code (default: EUR)
 */
export function formatCurrency(value: number | undefined | null, currency = 'EUR'): string {
  if (value === undefined || value === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number with locale-specific separators
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 */
export function formatNumber(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null) return '-';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a number as percentage with sign
 * @param value - Percentage value (e.g., 5.25 for 5.25%)
 */
export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format a date string for display
 * @param dateStr - ISO date string
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
```

**Learning point:** Now you have a single source of truth for formatting. When you update a format, it changes everywhere.

---

### Step 1.4: Create QueryClient Configuration

Create `apps/web/src/lib/query-client.ts`:

```typescript
import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Global QueryClient configuration
 *
 * This centralizes:
 * - Default cache times
 * - Global error handling
 * - Retry logic
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 30 seconds (won't refetch during this time)
      staleTime: 30 * 1000,
      // Keep unused data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry failed requests once
      retry: 1,
      // Refetch when window regains focus
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Show toast on mutation errors
      onError: (error) => {
        const message = error instanceof Error ? error.message : 'An error occurred';
        toast.error(message);
      },
    },
  },
});
```

**Learning point:** Previously, QueryClient was created inline in App.tsx with no configuration. Now it has sensible defaults and global error handling.

---

## Phase 2: Create Folder Structure

Before writing any code, create the folder structure. This helps you visualize the architecture.

```bash
cd apps/web/src

# Create feature folders
mkdir -p features/auth/components features/auth/hooks
mkdir -p features/dashboard/components
mkdir -p features/positions/components
mkdir -p features/transactions/components
mkdir -p features/import/components

# Create routes folder (TanStack Router)
mkdir -p routes/_authenticated/dashboard
mkdir -p routes/_authenticated/positions
mkdir -p routes/_authenticated/transactions

# Create other folders
mkdir -p components/layout
mkdir -p components/ui
mkdir -p hooks/api
mkdir -p types
mkdir -p __tests__/mocks
```

**Learning point:** The `_authenticated` prefix in routes creates a "layout route" - a wrapper that applies to all child routes. We'll use it for auth protection.

---

## Phase 3: Extract Auth Feature

### Step 3.1: Move useAuth Hook

Create `apps/web/src/features/auth/hooks/use-auth.ts`:

Copy the content from `src/hooks/useAuth.ts` but update imports:

```typescript
import type { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';  // Changed to use path alias

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };
}
```

---

### Step 3.2: Extract LoginForm Component

Create `apps/web/src/features/auth/components/login-form.tsx`:

Extract the LoginForm from App.tsx:

```typescript
import { useState } from 'react';
import { useAuth } from '../hooks/use-auth';

export function LoginForm() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="bg-slate-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Portfolio Aggregator</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md transition-colors"
          >
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full py-2 px-4 text-slate-400 hover:text-white transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

### Step 3.3: Create Auth Feature Barrel Export

Create `apps/web/src/features/auth/index.ts`:

```typescript
// Components
export { LoginForm } from './components/login-form';

// Hooks
export { useAuth } from './hooks/use-auth';
```

**Learning point:** Barrel exports (`index.ts`) let consumers import from the feature root: `import { LoginForm, useAuth } from '@/features/auth'`

---

## Phase 4: Extract Dashboard Feature

### Step 4.1: Create SummaryCards Component

Create `apps/web/src/features/dashboard/components/summary-cards.tsx`:

```typescript
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  title: string;
  value: string;
  color: 'blue' | 'green' | 'red' | 'slate';
}

const colorClasses = {
  blue: 'bg-blue-900/50 border-blue-700',
  green: 'bg-green-900/50 border-green-700',
  red: 'bg-red-900/50 border-red-700',
  slate: 'bg-slate-800 border-slate-700',
};

export function SummaryCard({ title, value, color }: SummaryCardProps) {
  return (
    <div className={cn('rounded-lg p-4 border', colorClasses[color])}>
      <p className="text-sm text-slate-400">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

interface SummaryCardsProps {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  pnlPercentage: number;
  isLoading?: boolean;
}

export function SummaryCards({
  totalValue,
  totalCost,
  totalPnl,
  pnlPercentage,
  isLoading,
}: SummaryCardsProps) {
  const { formatCurrency } = await import('@/lib/utils');

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg p-4 border bg-slate-800 border-slate-700 animate-pulse">
            <div className="h-4 bg-slate-700 rounded w-20 mb-2" />
            <div className="h-8 bg-slate-700 rounded w-28" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <SummaryCard title="Total Value" value={formatCurrency(totalValue)} color="blue" />
      <SummaryCard title="Total Cost" value={formatCurrency(totalCost)} color="slate" />
      <SummaryCard
        title="Total P&L"
        value={formatCurrency(totalPnl)}
        color={totalPnl >= 0 ? 'green' : 'red'}
      />
      <SummaryCard
        title="P&L %"
        value={`${pnlPercentage >= 0 ? '+' : ''}${pnlPercentage.toFixed(2)}%`}
        color={pnlPercentage >= 0 ? 'green' : 'red'}
      />
    </div>
  );
}
```

**Oops!** The above has a bug - you can't use `await import()` in a regular function like that. Fix it:

```typescript
import { cn, formatCurrency } from '@/lib/utils';

// ... rest of the code, using formatCurrency directly
```

---

### Step 4.2: Create AccountsGrid Component

Create `apps/web/src/features/dashboard/components/accounts-grid.tsx`:

```typescript
import type { Account } from '@/lib/api';

interface AccountsGridProps {
  accounts: Account[] | undefined;
  isLoading: boolean;
  onAddAccount: () => void;
}

export function AccountsGrid({ accounts, isLoading, onAddAccount }: AccountsGridProps) {
  if (isLoading) {
    return <p className="text-slate-400">Loading accounts...</p>;
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="w-12 h-12 mx-auto text-slate-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <p className="text-slate-400 mt-2">No accounts yet</p>
        <p className="text-sm text-slate-500">Import a CSV from your broker to get started</p>
        <button
          type="button"
          onClick={onAddAccount}
          className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md transition-colors"
        >
          Import CSV
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {accounts.map((account) => (
        <div
          key={account.id}
          className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-600/20 flex items-center justify-center">
              <span className="text-primary-400 font-bold text-sm">
                {account.broker.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-white capitalize">
                {account.broker.replace('-', ' ')}
              </p>
              <p className="text-sm text-slate-400">{account.accountName || 'Main Account'}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-600 flex justify-between text-sm">
            <span className="text-slate-400">Currency</span>
            <span className="text-white">{account.currency}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

### Step 4.3: Create Dashboard Barrel Export

Create `apps/web/src/features/dashboard/index.ts`:

```typescript
export { AccountsGrid } from './components/accounts-grid';
export { SummaryCard, SummaryCards } from './components/summary-cards';
```

---

## Phase 5: Extract Positions Feature

### Step 5.1: Move PositionsTable

Create `apps/web/src/features/positions/components/positions-table.tsx`:

Copy from `src/components/PositionsTable.tsx` but update imports to use path aliases:

```typescript
import { useQuery } from '@tanstack/react-query';
import type { Position } from '@/lib/api';
import { api } from '@/lib/api';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';

export function PositionsTable() {
  // ... rest of the component stays the same
}
```

### Step 5.2: Create Barrel Export

Create `apps/web/src/features/positions/index.ts`:

```typescript
export { PositionsTable } from './components/positions-table';
```

---

## Phase 6: Extract Transactions Feature

### Step 6.1: Move TransactionsTable

Create `apps/web/src/features/transactions/components/transactions-table.tsx`:

Copy from `src/components/TransactionsTable.tsx` but update imports:

```typescript
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Transaction } from '@/lib/api';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

// ... rest of the component
```

### Step 6.2: Create Barrel Export

Create `apps/web/src/features/transactions/index.ts`:

```typescript
export { TransactionsTable } from './components/transactions-table';
```

---

## Phase 7: Extract Import Feature

### Step 7.1: Move ImportModal

Create `apps/web/src/features/import/components/import-modal.tsx`:

Copy from `src/components/ImportModal.tsx` but update imports:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { ImportResult } from '@/lib/api';
import { api } from '@/lib/api';

// ... rest of the component
```

### Step 7.2: Create Barrel Export

Create `apps/web/src/features/import/index.ts`:

```typescript
export { ImportModal } from './components/import-modal';
```

---

## Phase 8: Create Layout Components

### Step 8.1: Create Header Component

Create `apps/web/src/components/layout/header.tsx`:

```typescript
import type { User } from '@supabase/supabase-js';

interface HeaderProps {
  user: User | null;
  onImportClick: () => void;
  onSignOut: () => void;
}

export function Header({ user, onImportClick, onSignOut }: HeaderProps) {
  return (
    <header className="bg-slate-800 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-white">Portfolio Aggregator</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onImportClick}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md transition-colors flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Import
          </button>
          <span className="text-slate-400">{user?.email}</span>
          <button
            type="button"
            onClick={onSignOut}
            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
```

---

### Step 8.2: Create PageLayout Component

Create `apps/web/src/components/layout/page-layout.tsx`:

```typescript
import type { ReactNode } from 'react';

interface PageLayoutProps {
  children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {children}
    </main>
  );
}
```

---

### Step 8.3: Create Layout Barrel Export

Create `apps/web/src/components/layout/index.ts`:

```typescript
export { Header } from './header';
export { PageLayout } from './page-layout';
```

---

## Phase 9: Create TanStack Query Hooks

Organize data fetching into reusable hooks.

### Step 9.1: Create Accounts Hook

Create `apps/web/src/hooks/api/use-accounts.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: ['accounts', id],
    queryFn: () => api.getAccount(id),
    enabled: !!id,
  });
}
```

---

### Step 9.2: Create Positions Hook

Create `apps/web/src/hooks/api/use-positions.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: api.getPositions,
  });
}

export function usePositionsSummary() {
  return useQuery({
    queryKey: ['positions-summary'],
    queryFn: api.getPositionsSummary,
  });
}

export function usePositionsByAccount(accountId: string) {
  return useQuery({
    queryKey: ['positions', 'account', accountId],
    queryFn: () => api.getPositionsByAccount(accountId),
    enabled: !!accountId,
  });
}
```

---

### Step 9.3: Create Transactions Hook

Create `apps/web/src/hooks/api/use-transactions.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface TransactionFilters {
  accountId?: string;
  securityId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

export function useTransactions(filters?: TransactionFilters) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => api.getTransactions(filters),
  });
}

export function useTransactionStats(accountId?: string) {
  return useQuery({
    queryKey: ['transactions', 'stats', accountId],
    queryFn: () => api.getTransactionStats(accountId),
  });
}
```

---

### Step 9.4: Create Import Mutation Hook

Create `apps/web/src/hooks/api/use-import.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useImportCSV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.importCSV,
    onSuccess: () => {
      // Invalidate all related queries after successful import
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['positions-summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      broker,
      type,
    }: {
      file: File;
      broker?: string;
      type?: 'investment' | 'bank';
    }) => api.uploadFile(file, broker, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['positions-summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
```

---

### Step 9.5: Create Hooks Barrel Export

Create `apps/web/src/hooks/api/index.ts`:

```typescript
export { useAccounts, useAccount } from './use-accounts';
export { usePositions, usePositionsSummary, usePositionsByAccount } from './use-positions';
export { useTransactions, useTransactionStats } from './use-transactions';
export { useImportCSV, useUploadFile } from './use-import';
```

---

## Phase 10: Set Up TanStack Router

This is the most complex phase - setting up file-based routing.

### Step 10.1: Add Router Plugin to Vite

Update `apps/web/vite.config.ts`:

```typescript
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  plugins: [
    // TanStack Router plugin MUST come before React plugin
    TanStackRouterVite(),
    react(),
    tailwindcss(),
    VitePWA({
      // ... existing PWA config
    }),
  ],
  // ... rest of config
});
```

You'll also need to install the router plugin:

```bash
bun add -D @tanstack/router-plugin
```

---

### Step 10.2: Create Root Route

Create `apps/web/src/routes/__root.tsx`:

```typescript
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { Toaster } from 'sonner';
import { queryClient } from '@/lib/query-client';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Main app content */}
      <Outlet />

      {/* Toast notifications */}
      <Toaster position="top-right" theme="dark" />

      {/* Dev tools - only shown in development */}
      {import.meta.env.DEV && (
        <>
          <ReactQueryDevtools initialIsOpen={false} />
          <TanStackRouterDevtools position="bottom-right" />
        </>
      )}
    </QueryClientProvider>
  );
}
```

---

### Step 10.3: Create Index Route (Redirect)

Create `apps/web/src/routes/index.tsx`:

```typescript
import { Navigate, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

function IndexPage() {
  // Redirect to dashboard
  return <Navigate to="/dashboard" />;
}
```

---

### Step 10.4: Create Login Route

Create `apps/web/src/routes/login.tsx`:

```typescript
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { LoginForm, useAuth } from '@/features/auth';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate({ to: '/dashboard' });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return <LoginForm />;
}
```

---

### Step 10.5: Create Authenticated Layout Route

Create `apps/web/src/routes/_authenticated/route.tsx`:

```typescript
import { Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Header, PageLayout } from '@/components/layout';
import { useAuth } from '@/features/auth';
import { ImportModal } from '@/features/import';
import { supabase } from '@/lib/supabase';

export const Route = createFileRoute('/_authenticated')({
  // This runs BEFORE the route renders - protects all child routes
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();

    // Development mode bypass
    const isDev = import.meta.env.VITE_DEV_MODE === 'true';

    if (!session && !isDev) {
      throw redirect({ to: '/login' });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isImportOpen, setIsImportOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: '/login' });
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <Header
        user={user}
        onImportClick={() => setIsImportOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* Navigation Tabs */}
      <nav className="bg-slate-800 border-b border-slate-700">
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

function NavTab({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="px-4 py-3 font-medium capitalize transition-colors"
      activeProps={{
        className: 'text-primary-400 border-b-2 border-primary-400',
      }}
      inactiveProps={{
        className: 'text-slate-400 hover:text-white',
      }}
    >
      {label}
    </Link>
  );
}
```

**Important:** You need to import `Link` from TanStack Router:

```typescript
import { Link, Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
```

---

### Step 10.6: Create Dashboard Page

Create `apps/web/src/routes/_authenticated/dashboard/index.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { AccountsGrid, SummaryCards } from '@/features/dashboard';
import { PositionsTable } from '@/features/positions';
import { TransactionsTable } from '@/features/transactions';
import { useAccounts, usePositionsSummary } from '@/hooks/api';

export const Route = createFileRoute('/_authenticated/dashboard/')({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = usePositionsSummary();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <SummaryCards
        totalValue={summary?.totalValue ?? 0}
        totalCost={summary?.totalCost ?? 0}
        totalPnl={summary?.totalPnl ?? 0}
        pnlPercentage={summary?.pnlPercentage ?? 0}
        isLoading={summaryLoading}
      />

      {/* Accounts Section */}
      <section className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Investment Accounts</h2>
        </div>
        <AccountsGrid
          accounts={accounts}
          isLoading={accountsLoading}
          onAddAccount={() => {
            // This will be handled by the parent layout's import modal
            // For now, you could emit an event or use a store
          }}
        />
      </section>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Top Positions</h2>
          <PositionsTable />
        </section>

        <section className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Transactions</h2>
          <TransactionsTable limit={5} />
        </section>
      </div>
    </div>
  );
}
```

---

### Step 10.7: Create Positions Page

Create `apps/web/src/routes/_authenticated/positions/index.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { PositionsTable } from '@/features/positions';
import { usePositionsSummary } from '@/hooks/api';

export const Route = createFileRoute('/_authenticated/positions/')({
  component: PositionsPage,
});

function PositionsPage() {
  const { data: summary } = usePositionsSummary();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">All Positions</h2>
        <div className="text-sm text-slate-400">
          {summary?.positionCount ?? 0} position{(summary?.positionCount ?? 0) !== 1 ? 's' : ''}
        </div>
      </div>
      <PositionsTable />
    </div>
  );
}
```

---

### Step 10.8: Create Transactions Page

Create `apps/web/src/routes/_authenticated/transactions/index.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { TransactionsTable } from '@/features/transactions';

export const Route = createFileRoute('/_authenticated/transactions/')({
  component: TransactionsPage,
});

function TransactionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">All Transactions</h2>
      </div>
      <TransactionsTable />
    </div>
  );
}
```

---

### Step 10.9: Update main.tsx

Update `apps/web/src/main.tsx`:

```typescript
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Import the generated route tree
import { routeTree } from './routeTree.gen';

// Create the router instance
const router = createRouter({ routeTree });

// Type safety for router
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

---

## Phase 11: Set Up Testing Infrastructure

### Step 11.1: Create Vitest Config

Create `apps/web/vitest.config.ts`:

```typescript
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/__tests__/'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

---

### Step 11.2: Create Test Setup

Create `apps/web/src/__tests__/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { server } from './mocks/server';

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Close MSW server after all tests
afterAll(() => server.close());
```

---

### Step 11.3: Create MSW Handlers

Create `apps/web/src/__tests__/mocks/handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:3000';

export const handlers = [
  // Accounts
  http.get(`${API_URL}/accounts`, () => {
    return HttpResponse.json([
      {
        id: '1',
        broker: 'degiro',
        accountId: 'account-1',
        accountName: 'Main Investment',
        currency: 'EUR',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ]);
  }),

  // Positions
  http.get(`${API_URL}/positions`, () => {
    return HttpResponse.json([
      {
        id: '1',
        quantity: 10,
        avgCost: 100,
        totalCost: 1000,
        marketPrice: 110,
        marketValue: 1100,
        unrealizedPnl: 100,
        currency: 'EUR',
        account: { id: '1', broker: 'degiro' },
        security: {
          id: '1',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          isin: 'US0378331005',
        },
      },
    ]);
  }),

  // Positions Summary
  http.get(`${API_URL}/positions/summary`, () => {
    return HttpResponse.json({
      totalValue: 1100,
      totalCost: 1000,
      totalPnl: 100,
      pnlPercentage: 10,
      positionCount: 1,
    });
  }),

  // Transactions
  http.get(`${API_URL}/transactions`, () => {
    return HttpResponse.json([
      {
        id: '1',
        date: '2024-01-15T00:00:00Z',
        type: 'buy',
        quantity: 10,
        price: 100,
        amount: 1000,
        fees: 2,
        currency: 'EUR',
        account: { id: '1', broker: 'degiro' },
        security: { id: '1', symbol: 'AAPL', name: 'Apple Inc.' },
      },
    ]);
  }),
];
```

---

### Step 11.4: Create MSW Server

Create `apps/web/src/__tests__/mocks/server.ts`:

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

---

### Step 11.5: Create Test Utilities

Create `apps/web/src/__tests__/test-utils.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from '@tanstack/react-router';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

interface WrapperProps {
  children: ReactNode;
}

function createWrapper() {
  const queryClient = createTestQueryClient();

  return function Wrapper({ children }: WrapperProps) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: createWrapper(), ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render with our custom version
export { customRender as render };
```

---

### Step 11.6: Add Example Test

Create `apps/web/src/features/positions/__tests__/positions-table.spec.tsx`:

```typescript
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { render } from '@/__tests__/test-utils';
import { PositionsTable } from '../components/positions-table';

describe('PositionsTable', () => {
  it('renders loading state initially', () => {
    render(<PositionsTable />);
    expect(screen.getByText(/loading positions/i)).toBeInTheDocument();
  });

  it('renders positions after loading', async () => {
    render(<PositionsTable />);

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
  });

  it('displays the correct market value', async () => {
    render(<PositionsTable />);

    await waitFor(() => {
      expect(screen.getByText('€1,100.00')).toBeInTheDocument();
    });
  });
});
```

---

### Step 11.7: Add Test Scripts to package.json

Update `apps/web/package.json` to add test scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## Phase 12: Cleanup Old Files

Once everything is working, delete the old files:

```bash
# Delete old files
rm src/App.tsx
rm -rf src/components/
rm src/hooks/useAuth.ts
```

---

## Verification Checklist

After completing all phases, verify:

- [ ] `bun run dev` starts without errors
- [ ] Navigation between /dashboard, /positions, /transactions works
- [ ] Auth protection redirects to /login when not authenticated
- [ ] Import modal opens and imports work
- [ ] `bun run test` passes all tests
- [ ] `bun run type-check` has no errors
- [ ] `bun run lint` passes

---

## If You Get Stuck

1. **TanStack Router not generating routes?**
   - Make sure `@tanstack/router-plugin` is installed
   - Check that TanStackRouterVite() is BEFORE react() in plugins

2. **Path aliases not working?**
   - Restart your TypeScript server in VSCode
   - Check both tsconfig.app.json AND vite.config.ts have the alias

3. **Tests failing?**
   - Make sure MSW is set up correctly in setup.ts
   - Check that vitest.config.ts has the correct path alias

---

## Learning Resources

- [TanStack Router Docs](https://tanstack.com/router/latest/docs/framework/react/overview)
- [TanStack Query Docs](https://tanstack.com/query/latest/docs/framework/react/overview)
- [MSW (Mock Service Worker)](https://mswjs.io/docs/)
- [Vitest](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
