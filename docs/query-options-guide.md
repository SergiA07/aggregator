# Query Options Pattern Guide

This guide explains the `queryOptions` pattern from TanStack Query v5 and when to use it.

## Table of Contents

- [What is queryOptions?](#what-is-queryoptions)
- [When You DON'T Need It](#when-you-dont-need-it)
- [When You DO Need It](#when-you-do-need-it)
- [Real Examples](#real-examples)

---

## What is queryOptions?

`queryOptions` is a helper function that creates a reusable configuration object for queries.

```typescript
import { queryOptions } from '@tanstack/react-query';

// Create a reusable config
function accountListOptions() {
  return queryOptions({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
  });
}
```

This config object can be used in multiple places:

```typescript
// In a component
useQuery(accountListOptions());

// For prefetching
queryClient.prefetchQuery(accountListOptions());

// Reading from cache
queryClient.getQueryData(accountListOptions().queryKey);
```

---

## When You DON'T Need It

If you're **only** using queries inside React components, a simple custom hook works perfectly:

```typescript
// Simple custom hook - totally fine!
function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
  });
}

// Usage in component
function AccountsList() {
  const { data, isLoading } = useAccounts();
  // ...
}
```

**Use custom hooks when:**
- You only need the data inside React components
- You want to add component-specific logic to the hook
- Your app doesn't use route loaders or SSR

---

## When You DO Need It

### 1. Route Loaders (TanStack Router)

Route loaders run **before** the component renders. They're not React components, so you can't use hooks.

```typescript
// routes/_authenticated/dashboard.tsx
import { createFileRoute } from '@tanstack/react-router';
import { accountListOptions } from '@/lib/api/queries/accounts';

export const Route = createFileRoute('/dashboard')({
  // This runs BEFORE the component - not a React component!
  loader: async ({ context }) => {
    // Prefetch data so it's ready when component renders
    await context.queryClient.ensureQueryData(accountListOptions());
  },
  component: DashboardPage,
});

function DashboardPage() {
  // Data is already cached - no loading spinner!
  const { data } = useQuery(accountListOptions());
}
```

**Without queryOptions**, you'd have to duplicate the config:

```typescript
// BAD: Duplicated config
loader: async ({ context }) => {
  await context.queryClient.ensureQueryData({
    queryKey: ['accounts'],        // Duplicated!
    queryFn: api.getAccounts,      // Duplicated!
  });
},
```

---

### 2. Prefetching on Hover/Focus

Prefetch data when user hovers over a link (before they click):

```typescript
import { accountListOptions } from '@/lib/api/queries/accounts';

function NavLink() {
  const queryClient = useQueryClient();

  const handleMouseEnter = () => {
    // Start fetching before user clicks
    queryClient.prefetchQuery(accountListOptions());
  };

  return (
    <Link to="/accounts" onMouseEnter={handleMouseEnter}>
      View Accounts
    </Link>
  );
}
```

**Why this works:** `prefetchQuery` is called from an event handler, not during render. With a custom hook, you couldn't reuse the query config here.

---

### 3. Reading Cache Outside Components

Sometimes you need to read cached data from a non-React context:

```typescript
import { accountListOptions } from '@/lib/api/queries/accounts';

// Utility function (not a React component or hook)
function getAccountById(id: string) {
  const accounts = queryClient.getQueryData(accountListOptions().queryKey);
  return accounts?.find(account => account.id === id);
}

// Use anywhere - event handlers, utilities, etc.
function handleExport() {
  const account = getAccountById('123');
  exportToCSV(account);
}
```

---

### 4. Server-Side Rendering (SSR)

In SSR, you prefetch data on the server before sending HTML to the client:

```typescript
// Server-side code (not React!)
import { accountListOptions } from '@/lib/api/queries/accounts';

async function getServerSideProps() {
  const queryClient = new QueryClient();

  // Prefetch on server
  await queryClient.prefetchQuery(accountListOptions());

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
  };
}
```

---

### 5. Sharing Config Between useQuery and useSuspenseQuery

Both hooks can use the same config:

```typescript
import { accountListOptions } from '@/lib/api/queries/accounts';

// Regular query (shows loading state)
function AccountsWithLoading() {
  const { data, isLoading } = useQuery(accountListOptions());
  if (isLoading) return <Spinner />;
  return <AccountsList accounts={data} />;
}

// Suspense query (uses React Suspense)
function AccountsWithSuspense() {
  // No loading check needed - Suspense handles it
  const { data } = useSuspenseQuery(accountListOptions());
  return <AccountsList accounts={data} />;
}
```

---

## Real Examples

### Our Project Structure

```
src/lib/api/queries/
  accounts.ts    # accountKeys + accountListOptions, accountDetailOptions
  positions.ts   # positionKeys + positionListOptions, positionSummaryOptions
  transactions.ts # transactionKeys + transactionListOptions
  import.ts      # useUploadFile, useImportCSV (mutations)
```

### accounts.ts

```typescript
// lib/api/queries/accounts.ts
import { queryOptions } from '@tanstack/react-query';
import { api } from '../client';

// Keys for cache invalidation
export const accountKeys = {
  all: ['accounts'],
  lists: ['accounts', 'list'],
  details: ['accounts', 'detail'],
} as const;

// Query options for fetching all accounts
export function accountListOptions() {
  return queryOptions({
    queryKey: accountKeys.lists,
    queryFn: api.getAccounts,
  });
}

// Query options for fetching a single account
export function accountDetailOptions(id: string) {
  return queryOptions({
    queryKey: [...accountKeys.details, id],
    queryFn: () => api.getAccount(id),
    enabled: !!id,
  });
}
```

### Usage in Components

```typescript
import { useQuery } from '@tanstack/react-query';
import { accountListOptions } from '@/lib/api/queries/accounts';

function AccountsList() {
  const { data: accounts, isLoading } = useQuery(accountListOptions());

  if (isLoading) return <Spinner />;
  return (
    <ul>
      {accounts?.map(account => (
        <li key={account.id}>{account.name}</li>
      ))}
    </ul>
  );
}
```

### Usage in Route Loader

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { accountListOptions } from '@/lib/api/queries/accounts';

export const Route = createFileRoute('/accounts')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(accountListOptions());
  },
  component: AccountsPage,
});
```

### Usage for Cache Invalidation

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { accountKeys } from '@/lib/api/queries/accounts';

function DeleteAccountButton({ id }) {
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    await api.deleteAccount(id);
    // Invalidate all account queries
    queryClient.invalidateQueries({ queryKey: accountKeys.all });
  };

  return <button onClick={handleDelete}>Delete</button>;
}
```

---

## Summary

| Situation | Use Custom Hook? | Use queryOptions? |
|-----------|------------------|-------------------|
| Only in React components | Yes | Optional |
| Route loaders | No | **Yes** |
| Prefetch on hover | No | **Yes** |
| Read cache in utilities | No | **Yes** |
| SSR | No | **Yes** |
| Share between useQuery/useSuspenseQuery | Either works | Cleaner |

**Rule of thumb:** If you need the query config outside of `useQuery()` in a React component, use `queryOptions`.

---

## ensureQueryData vs prefetchQuery

These two methods are often confused. Here's the difference:

| Method | Returns | Waits? | Use Case |
|--------|---------|--------|----------|
| `prefetchQuery` | `Promise<void>` | No | Fire-and-forget (hover, background) |
| `ensureQueryData` | `Promise<TData>` | Yes | When you need data or must wait |

### prefetchQuery - Fire and Forget

```typescript
// On hover - start fetching, don't wait
onMouseEnter={() => {
  queryClient.prefetchQuery(accountListOptions());
  // Doesn't block - user can still click immediately
}}
```

### ensureQueryData - Wait for Data

```typescript
// In route loader - MUST wait before rendering
loader: async ({ context: { queryClient } }) => {
  // Wait for data - route won't render until complete
  await queryClient.ensureQueryData(accountListOptions());
}
```

**When to use which:**
- **Hover/focus prefetching**: `prefetchQuery` (don't block user interaction)
- **Route loaders**: `ensureQueryData` (must have data before render)
- **Need the data returned**: `ensureQueryData` (returns the data)
- **Just warming the cache**: `prefetchQuery` (don't need the data now)

---

## Data Fetching Patterns Comparison

Our project uses three different patterns for data fetching:

### 1. useQuery (Traditional)

```typescript
function Dashboard() {
  const { data, isLoading, error } = useQuery(accountListOptions());

  if (isLoading) return <Spinner />;
  if (error) return <Error />;
  return <List items={data} />;
}
```

- Manual loading/error handling
- `data` type is `T | undefined`
- Most flexible, works everywhere

### 2. useSuspenseQuery (Suspense-based)

```typescript
function PositionsContent() {
  // No loading/error checks needed!
  const { data } = useSuspenseQuery(positionListOptions());
  return <List items={data} />;  // data is guaranteed
}

// Parent handles loading/error
<ErrorBoundary fallback={<Error />}>
  <Suspense fallback={<Spinner />}>
    <PositionsContent />
  </Suspense>
</ErrorBoundary>
```

- Suspense handles loading
- ErrorBoundary handles errors
- `data` type is `T` (guaranteed defined)
- Cleaner component code

### 3. useQuery().promise + React.use() (Experimental)

```typescript
function TransactionsPage() {
  const { promise } = useQuery(transactionListOptions());

  return (
    <Suspense fallback={<Spinner />}>
      <TransactionsContent promise={promise} />
    </Suspense>
  );
}

function TransactionsContent({ promise }) {
  const data = use(promise);  // React 19 use() hook
  return <List items={data} />;
}
```

- Uses React 19's `use()` hook
- Works with Suspense like useSuspenseQuery
- **Experimental** - may change in future versions
- Good for learning cutting-edge patterns

### When to Use Each

| Pattern | Best For |
|---------|----------|
| `useQuery` | Forms, conditional fetching, fine-grained control |
| `useSuspenseQuery` | Pages with guaranteed data, cleaner code |
| `useQuery().promise` + `use()` | Learning React 19, experimental features |
