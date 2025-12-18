---
paths: apps/web/**/*.spec.*, apps/web/**/*.test.*, apps/web/**/__tests__/**
---

# Frontend Testing Guidelines

## Test Runners

- **Unit/Integration**: Vitest + React Testing Library
- **E2E**: Playwright (at monorepo root `/e2e/`)

## Test Structure

```
src/
├── __tests__/                    # Shared test utilities
│   ├── utils/
│   │   └── render.tsx           # Custom render with providers
│   ├── mocks/
│   │   ├── handlers.ts          # MSW request handlers
│   │   └── data.ts              # Mocked API responses
│   └── setup.ts                 # Vitest setup (MSW server)
│
├── features/<feature>/
│   ├── components/
│   │   ├── SomeComponent.tsx
│   │   └── SomeComponent.spec.ts   # Unit test (co-located)
│   └── __tests__/                   # Integration tests
│       └── feature-page.spec.ts
```

## Running Tests

```bash
# From apps/web or monorepo root
bun test                    # Run all tests
bun test --watch           # Watch mode
bun test src/features      # Test specific directory
bun test --coverage        # With coverage

# E2E (from monorepo root)
bun run test:e2e
```

## Test Categories

| Type | Location | Purpose |
|------|----------|---------|
| Unit | Co-located (`*.spec.ts`) | Test components/hooks in isolation |
| Integration | `features/<feature>/__tests__/` | Test feature with mocked API |
| E2E | `/e2e/` (monorepo root) | Full stack tests |

## Custom Render

Always use the custom render that includes providers:

```typescript
// __tests__/utils/render.tsx
import { render as rtlRender } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from '@tanstack/react-router';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

export function render(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();

  return rtlRender(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

export * from '@testing-library/react';
```

## MSW Setup

### Handlers

```typescript
// __tests__/mocks/handlers.ts
import { http, HttpResponse } from 'msw';
import { mockPositions } from './data';

export const handlers = [
  http.get('*/api/v1/positions', () => {
    return HttpResponse.json(mockPositions);
  }),

  http.post('*/api/v1/transactions/import', async ({ request }) => {
    const formData = await request.formData();
    return HttpResponse.json({ imported: 10 });
  }),
];
```

### Setup File

```typescript
// __tests__/setup.ts
import { beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Vitest Config

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
  },
});
```

## Component Testing

### Basic Component Test

```typescript
// features/positions/components/PositionsTable.spec.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@/__tests__/utils/render';
import { PositionsTable } from './PositionsTable';

describe('PositionsTable', () => {
  it('renders position rows', async () => {
    render(<PositionsTable positions={mockPositions} />);

    expect(await screen.findByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('shows empty state when no positions', () => {
    render(<PositionsTable positions={[]} />);

    expect(screen.getByText(/no positions/i)).toBeInTheDocument();
  });
});
```

### Testing Hooks

```typescript
// hooks/api/usePositions.spec.ts
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePositions } from './usePositions';

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('usePositions', () => {
  it('fetches positions', async () => {
    const { result } = renderHook(() => usePositions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });
});
```

## Mocking TanStack Query

### Override Handlers Per Test

```typescript
import { server } from '@/__tests__/setup';
import { http, HttpResponse } from 'msw';

it('handles error state', async () => {
  server.use(
    http.get('*/api/v1/positions', () => {
      return HttpResponse.json({ message: 'Server error' }, { status: 500 });
    })
  );

  render(<PositionsPage />);

  expect(await screen.findByText(/error/i)).toBeInTheDocument();
});
```

### Mock Query Data Directly

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();
queryClient.setQueryData(['positions'], mockPositions);

render(
  <QueryClientProvider client={queryClient}>
    <PositionsTable />
  </QueryClientProvider>
);
```

## Mocking TanStack Router

### Test With Memory Router

```typescript
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { routeTree } from '@/routeTree.gen';

const testRouter = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ['/positions'] }),
});

render(<RouterProvider router={testRouter} />);
```

### Mock useNavigate

```typescript
import { vi } from 'vitest';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});
```

## User Interaction Testing

Use `@testing-library/user-event`:

```typescript
import userEvent from '@testing-library/user-event';

it('submits form on button click', async () => {
  const user = userEvent.setup();

  render(<LoginForm />);

  await user.type(screen.getByLabelText(/email/i), 'test@example.com');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /sign in/i }));

  await waitFor(() => {
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });
});
```

## Accessibility Testing

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

it('has no accessibility violations', async () => {
  const { container } = render(<PositionsTable positions={mockPositions} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Snapshot Testing

Use sparingly - prefer explicit assertions:

```typescript
it('matches snapshot', () => {
  const { container } = render(<SummaryCard title="Total" value="$10,000" />);
  expect(container).toMatchSnapshot();
});
```

## Integration Test Example

```typescript
// features/positions/__tests__/positions-page.spec.ts
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@/__tests__/utils/render';
import userEvent from '@testing-library/user-event';
import { PositionsPage } from '../components/PositionsPage';

describe('PositionsPage', () => {
  it('loads and displays positions', async () => {
    render(<PositionsPage />);

    // Loading state
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Data loaded
    expect(await screen.findByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });

  it('filters positions by search', async () => {
    const user = userEvent.setup();
    render(<PositionsPage />);

    await screen.findByText('AAPL');

    await user.type(screen.getByPlaceholderText(/search/i), 'MSFT');

    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });
});
```

## Best Practices

1. **Query by role/label** - Prefer `getByRole`, `getByLabelText` over `getByTestId`
2. **Avoid implementation details** - Test behavior, not internal state
3. **Use `findBy*` for async** - Wait for elements to appear
4. **One assertion per test** when practical
5. **Keep tests independent** - Reset state between tests
6. **Mock at boundaries** - Mock API calls, not internal functions
7. **Test error states** - Override MSW handlers for error scenarios
8. **Clean up** - Let Testing Library handle cleanup automatically
