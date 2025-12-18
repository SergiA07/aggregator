---
paths: apps/web/**
---

# Frontend Guidelines

## Project Structure

```
src/
├── assets/                    # Build-processed assets (images, fonts, icons)
├── routes/                    # TanStack Router file-based routes
│   ├── __root.tsx            # Root layout (providers)
│   ├── index.tsx             # "/" - redirect
│   ├── login.tsx             # "/login"
│   ├── _authenticated.tsx    # Protected layout
│   └── _authenticated/
│       ├── dashboard.tsx
│       ├── positions.tsx
│       ├── transactions.tsx
│       └── accounts.tsx
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
├── utils/                     # Shared utilities
├── lib/                       # External clients (api.ts, supabase.ts)
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

### Barrel Exports

Each feature exports its public API:

```typescript
// features/positions/index.ts
export { PositionsTable } from './components/PositionsTable';
export { usePositions } from './hooks/usePositions';
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

Routes are auto-generated from the file structure:

```typescript
// vite.config.ts
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
});
```

### Protected Routes

Use layout routes with `beforeLoad`:

```typescript
// routes/_authenticated.tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: '/login' });
    }
  },
  component: AuthenticatedLayout,
});
```

## TanStack Query

### Query Hooks Location

Place shared query hooks in `hooks/api/`:

```typescript
// hooks/api/usePositions.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: api.positions.getAll,
  });
}
```

### Mutations with Cache Invalidation

```typescript
// hooks/api/useImportTransactions.ts
export function useImportTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.import.upload,
    meta: {
      errorMessage: 'Failed to import transactions',
      successMessage: 'Transactions imported successfully',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
  });
}
```

### Global Error Handling

Configure at QueryClient level:

```typescript
// lib/query-client.ts
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
- Use `cn()` helper from `lib/utils.ts` for conditional classes

```typescript
import { cn } from '@/lib/utils';

<div className={cn('base-class', isActive && 'active-class')} />
```

## Path Aliases

Use `@/*` for imports:

```typescript
import { Button } from '@/components/ui/button';
import { PositionsTable } from '@/features/positions';
import { usePreferences } from '@/stores';
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
