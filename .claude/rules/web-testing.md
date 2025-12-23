---
paths: apps/web/**/*.spec.*, apps/web/**/*.test.*, apps/web/**/__tests__/**
---

# Frontend Testing Guidelines

## 3-Tier Testing Strategy

| Tier | Tool | Purpose | File Pattern |
|------|------|---------|--------------|
| **Unit/Integration** | Vitest + jsdom | Logic, hooks, components | `*.test.ts(x)` |
| **Component (Browser)** | Vitest Browser Mode | CSS, Canvas, browser APIs | `*.browser.test.tsx` |
| **E2E** | Playwright | Full user journeys | `e2e/*.e2e.ts` |

### When to Use Each Tier

- **jsdom tests** (`*.test.tsx`): Default for most tests. Tests component logic, user interactions, hooks.
- **Browser tests** (`*.browser.test.tsx`): Only when testing real CSS computed styles, Canvas, WebGL, or browser-specific APIs that jsdom cannot simulate.
- **E2E tests** (`*.e2e.ts`): Full-stack integration testing real API, database, and auth flows.

## Test Structure

```
src/
├── __tests__/                    # Shared test utilities
│   ├── test-utils.tsx           # Custom render with providers
│   ├── utils.ts                 # Test helpers (getTailwindColor, etc.)
│   ├── setup.ts                 # Vitest setup (jsdom + MSW)
│   └── mocks/
│       ├── handlers.ts          # MSW request handlers
│       └── data.ts              # Mocked API responses
│
├── components/
│   └── layout/
│       ├── header.tsx
│       ├── header.test.tsx          # jsdom tests (logic, interactions)
│       └── header.browser.test.tsx  # Browser tests (computed CSS)
│
├── features/<feature>/
│   ├── components/
│   │   ├── SomeComponent.tsx
│   │   └── SomeComponent.test.tsx   # Unit test (co-located)
│   └── __tests__/                   # Integration tests
│       └── feature-page.test.tsx

# At monorepo root:
e2e/
├── auth.e2e.ts                      # E2E tests
├── playwright-report/               # HTML reports (gitignored)
└── test-results/                    # Test artifacts (gitignored)
```

## Running Tests

```bash
# From apps/web
bun test                    # Run jsdom tests (fast)
bun test --watch           # Watch mode
bun test src/features      # Test specific directory
bun test:browser           # Run browser tests (real Chromium)

# From monorepo root
bun run e2e                # Run E2E tests (headless)
bun run e2e:ui             # Run with interactive UI
bun run e2e:debug          # Debug mode
```

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

---

## MSW Development Mode

MSW can be used for frontend development without a running backend. This uses the same handlers as your tests, ensuring consistency between development and testing.

### When to Use

- **Backend not ready** - Start frontend development before API is complete
- **Offline development** - Work without network access
- **Demo/prototype** - Show features without real data
- **Isolated debugging** - Test frontend behavior without backend variables

### Setup

#### 1. Create Browser Worker

The browser worker is separate from the Node server used in tests:

```typescript
// __tests__/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

#### 2. Enable in main.tsx

Conditionally start MSW when `VITE_MOCK_API=true`:

```typescript
// main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { queryClient } from '@/lib/query-client';
import { router } from '@/lib/router';
import './index.css';

async function enableMocking() {
  // Only enable in development when VITE_MOCK_API is set
  if (import.meta.env.VITE_MOCK_API !== 'true') {
    return;
  }

  const { worker } = await import('./__tests__/mocks/browser');

  // Start the service worker
  return worker.start({
    onUnhandledRequest: 'warn', // Log unhandled requests (helpful for debugging)
  });
}

// Start app after MSW is ready
enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
});
```

#### 3. Add Development Scripts

```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "dev:mock": "VITE_MOCK_API=true vite"
  }
}
```

### Usage

```bash
# Normal development (uses real API)
bun run dev

# Development with mocked API
bun run dev:mock
```

### Visual Indicator (Optional)

Add a visual indicator when running with mocked data:

```typescript
// components/dev/mock-indicator.tsx
export function MockIndicator() {
  if (import.meta.env.VITE_MOCK_API !== 'true') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold z-50">
      🔶 MOCK API
    </div>
  );
}

// Add to root layout
<MockIndicator />
```

### Handler Reuse Pattern

The same handlers are used across:

```
__tests__/mocks/handlers.ts
         │
         ├──► __tests__/mocks/node.ts    → Vitest (jsdom)
         ├──► __tests__/mocks/browser.ts → Vitest Browser Mode
         ├──► main.tsx (dev:mock)        → Development
         └──► storybook/preview.tsx      → Storybook (if used)
```

This ensures **consistent mocked behavior** everywhere.

### Adding Mock Data States

Create handlers for different scenarios:

```typescript
// __tests__/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

// Default handlers with realistic data
export const handlers = [
  http.get('*/api/v1/positions', () => {
    return HttpResponse.json([
      { id: '1', symbol: 'AAPL', shares: 10, currentValue: 1750 },
      { id: '2', symbol: 'GOOGL', shares: 5, currentValue: 7500 },
    ]);
  }),
];

// Scenario: Empty state
export const emptyHandlers = [
  http.get('*/api/v1/positions', () => {
    return HttpResponse.json([]);
  }),
];

// Scenario: Error state
export const errorHandlers = [
  http.get('*/api/v1/positions', () => {
    return HttpResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }),
];

// Scenario: Loading delay (for testing loading states)
export const slowHandlers = [
  http.get('*/api/v1/positions', async () => {
    await new Promise(resolve => setTimeout(resolve, 3000));
    return HttpResponse.json([{ id: '1', symbol: 'AAPL', shares: 10 }]);
  }),
];
```

Switch scenarios via query param or env var for testing different UI states during development.
