---
paths: apps/web/**
---

# Frontend Guidelines

## Project Structure

```
src/
├── assets/                    # Build-processed assets (images, fonts, icons)
├── routes/                    # TanStack Router file-based routes
│   ├── __root.tsx            # Root layout (providers, devtools)
│   ├── index.tsx             # "/" - redirect to /dashboard
│   ├── login.tsx             # "/login"
│   └── _authenticated/       # Protected route group (pathless layout)
│       ├── route.tsx         # Auth guard + layout (beforeLoad)
│       ├── dashboard.tsx     # "/dashboard"
│       ├── positions.tsx     # "/positions"
│       ├── transactions.tsx  # "/transactions"
│       └── accounts.tsx      # "/accounts"
├── features/                  # Feature modules (1:1 with routes)
│   ├── auth/
│   ├── dashboard/
│   ├── positions/
│   ├── transactions/
│   └── accounts/
├── components/
│   ├── ui/                   # Shadcn primitives (DO NOT EDIT)
│   ├── composed/             # Custom compositions
│   └── layout/               # Header, Sidebar, PageLayout
├── hooks/
│   └── api/                  # TanStack Query hooks
├── stores/                    # Zustand stores
├── utils/                     # Pure utilities (no barrel - use direct imports)
│   ├── cn.ts                 # Tailwind class merging
│   └── formatters.ts         # formatCurrency, formatDate, etc.
├── lib/                       # External service clients (no barrel - use direct imports)
│   ├── api/
│   │   ├── client.ts         # API client (fetchWithAuth, api object)
│   │   ├── types.ts          # API types (Account, Position, etc.)
│   │   ├── query-client.ts   # TanStack Query config
│   │   └── queries/          # TanStack Query options (official v5 pattern)
│   │       ├── accounts.ts   # accountKeys + accountListOptions, accountDetailOptions
│   │       ├── positions.ts  # positionKeys + positionListOptions, etc.
│   │       ├── transactions.ts # transactionKeys + transactionListOptions
│   │       └── import.ts     # useUploadFile, useImportCSV mutations
│   ├── supabase.ts           # Supabase client
│   ├── router.ts             # TanStack Router config + type registration
│   └── router-context.ts     # TanStack Router context type
├── hooks/                     # Shared custom hooks (non-API)
├── types/                     # Shared TypeScript types
└── __tests__/                 # Shared test utilities
```

## Feature Organization

Each feature maps 1:1 to a route and is self-contained:

```
features/<feature>/
├── components/           # Feature-specific components
│   ├── SomeComponent.tsx
│   └── SomeComponent.spec.ts  # Co-located unit test
├── hooks/                # Feature-specific hooks
├── __tests__/            # Integration tests
└── index.ts              # Public API (barrel export)
```

### Barrel Exports (Features Only)

Use barrel exports **only for features** - they define the public API of each feature:

```typescript
// features/positions/index.ts
export { PositionsTable } from './components/PositionsTable';
export { usePositions } from './hooks/usePositions';
```

**Do NOT use barrels for `lib/` or `utils/`** - use direct imports instead to avoid circular dependencies and improve tree-shaking:

```typescript
// Direct imports (preferred for lib/ and utils/)
import { api } from '@/lib/api/client';
import type { Account } from '@/lib/api/types';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/utils/cn';

// Feature barrel imports (preferred for features/)
import { PositionsTable } from '@/features/positions';
```

## Routes vs Features

- **`routes/`**: Thin page components - URL structure, params, loaders
- **`features/`**: Business logic, domain components, feature-specific hooks

Routes compose feature components:

```typescript
// routes/_authenticated/positions.tsx
import { PositionsTable, PositionsFilters } from '@/features/positions';

export const Route = createFileRoute('/_authenticated/positions')({
  component: PositionsPage,
});

function PositionsPage() {
  return (
    <PageLayout title="Positions">
      <PositionsFilters />
      <PositionsTable />
    </PageLayout>
  );
}
```

## Component Organization

| Folder | Purpose | Edit? |
|--------|---------|-------|
| `components/ui/` | Shadcn primitives | No - treat as vendor |
| `components/composed/` | Custom compositions of Shadcn | Yes |
| `components/layout/` | App layout (Header, Sidebar) | Yes |
| `features/*/components/` | Feature-specific components | Yes |

### Shadcn Convention

Install Shadcn components to `components/ui/`:

```bash
bunx shadcn@latest add button
```

Create compositions in `components/composed/`:

```typescript
// components/composed/data-table.tsx
import { Table, TableBody, TableCell } from '@/components/ui/table';
// Custom enhanced table with sorting, filtering
```

## TanStack Router

### File-Based Routing

Routes are auto-generated from the file structure. The Vite plugin watches `src/routes/` and generates `routeTree.gen.ts` automatically.

```typescript
// vite.config.ts
import { tanstackRouter } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    // TanStack Router plugin MUST come before React plugin
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,  // Automatic lazy loading of route components
    }),
    react(),
  ],
});
```

**Key options:**
- `target: 'react'` - Required for React projects
- `autoCodeSplitting: true` - Automatically lazy-loads route components (no `React.lazy()` needed)

### Router Context

Pass shared context (like `queryClient`) to routes via `createRootRouteWithContext`:

```typescript
// lib/router-context.ts
import type { QueryClient } from '@tanstack/react-query';

export interface RouterContext {
  queryClient: QueryClient;
}
```

```typescript
// routes/__root.tsx
import { createRootRouteWithContext } from '@tanstack/react-router';
import type { RouterContext } from '@/lib/router-context';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});
```

### Protected Routes

Use layout routes with `beforeLoad`. Name the file `route.tsx` inside the folder:

```typescript
// routes/_authenticated/route.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { supabase } from '@/lib/supabase';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const isDev = import.meta.env.VITE_DEV_MODE === 'true';
    if (!session && !isDev) {
      throw redirect({ to: '/login' });
    }
  },
  component: AuthenticatedLayout,
});
```

**Note:** `route.tsx` is the convention for layout routes. The `beforeLoad` runs before any child routes render, making it ideal for auth guards.

## TanStack Query

### Query Options Pattern (Official v5)

Use `queryOptions()` for reusable query configurations. Place in `lib/api/queries/`:

```typescript
// lib/api/queries/positions.ts
import { queryOptions } from '@tanstack/react-query';
import { api } from '../client';

// Keys for cache invalidation
export const positionKeys = {
  all: ['positions'],
  lists: ['positions', 'list'],
  summaries: ['positions', 'summary'],
} as const;

// Query options - reusable with useQuery, prefetchQuery, etc.
export function positionListOptions() {
  return queryOptions({
    queryKey: positionKeys.lists,
    queryFn: api.getPositions,
  });
}
```

**Usage:**
```typescript
import { useQuery } from '@tanstack/react-query';
import { positionListOptions, positionKeys } from '@/lib/api/queries/positions';

// In components
const { data } = useQuery(positionListOptions());

// For prefetching (e.g., on hover)
queryClient.prefetchQuery(positionListOptions());

// For cache invalidation
queryClient.invalidateQueries({ queryKey: positionKeys.all });
```

### Mutations with Cache Invalidation

Place mutation hooks in `lib/api/queries/` alongside query options:

```typescript
// lib/api/queries/import.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { accountKeys } from './accounts';
import { positionKeys } from './positions';
import { transactionKeys } from './transactions';

export function useUploadFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, broker, type }) => api.uploadFile(file, broker, type),
    meta: {
      errorMessage: 'Failed to upload file',
      successMessage: 'File uploaded successfully',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      queryClient.invalidateQueries({ queryKey: positionKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}
```

### Global Error Handling

Configure at QueryClient level:

```typescript
// lib/api/query-client.ts
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data !== undefined) {
        toast.error(`Failed to refresh: ${error.message}`);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const message = mutation.meta?.errorMessage as string || error.message;
      toast.error(message);
    },
    onSuccess: (_data, _variables, _context, mutation) => {
      if (mutation.meta?.successMessage) {
        toast.success(mutation.meta.successMessage as string);
      }
    },
  }),
});
```

## State Management

| State Type | Tool | Storage |
|------------|------|---------|
| Server state | TanStack Query | API cache |
| Client preferences | Zustand + persist | localStorage |
| Ephemeral UI | React useState | Memory |

### Zustand Stores

```typescript
// stores/preferences.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PreferencesState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'dark',
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'user-preferences' }
  )
);
```

## React 19 Features

### Applicable to Client SPA

| Feature | Use Case |
|---------|----------|
| React Compiler | Auto-optimization (no manual memo/useCallback) |
| `use()` hook | Read context without useContext wrapper |
| `useOptimistic` | Optimistic UI updates with mutations |
| `useActionState` | Simple form state (login, settings) |
| `useFormStatus` | Pending state in submit buttons |

### Mutations Strategy

| Use Case | Tool |
|----------|------|
| API mutations affecting cache | TanStack Query `useMutation` |
| Simple forms (no cache) | React 19 `useActionState` |
| Pending UI | `useFormStatus` |

### useActionState Example (Login)

```typescript
// features/auth/components/LoginForm.tsx
import { useActionState } from 'react';

async function loginAction(prevState: string | null, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

export function LoginForm() {
  const [error, submitAction, isPending] = useActionState(loginAction, null);

  return (
    <form action={submitAction}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <SubmitButton>Sign In</SubmitButton>
      {error && <p className="text-red-500">{error}</p>}
    </form>
  );
}
```

### useFormStatus Example

```typescript
// components/composed/submit-button.tsx
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Submitting...' : children}
    </Button>
  );
}
```

## Styling

- Use Tailwind CSS v4 utility classes
- Shadcn components use CSS variables for theming
- Use `cn()` helper from `utils/cn.ts` for conditional classes

```typescript
import { cn } from '@/utils/cn';

<div className={cn('base-class', isActive && 'active-class')} />
```

## Path Aliases

Use `@/*` for imports:

```typescript
// Direct imports for lib/api/
import { api } from '@/lib/api/client';
import type { Position } from '@/lib/api/types';
import { queryClient } from '@/lib/api/query-client';
import { positionListOptions } from '@/lib/api/queries/positions';

// Direct imports for other lib/
import { supabase } from '@/lib/supabase';
import { router } from '@/lib/router';

// Direct imports for utils/
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/utils/cn';

// Barrel imports for features/
import { PositionsTable } from '@/features/positions';

// Direct imports for other folders
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/stores/preferences';
```

## File Naming

- **Files**: kebab-case (`submit-button.tsx`, `use-positions.ts`)
- **Components**: PascalCase (`SubmitButton`)
- **Hooks**: camelCase with `use` prefix (`usePositions`)

## Performance

- React Compiler handles memoization automatically
- Use TanStack Query's `staleTime` and `gcTime` for caching
- Lazy load routes (TanStack Router handles this)
- Keep bundle size in check with dynamic imports for heavy components
