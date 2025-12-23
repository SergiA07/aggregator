import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { queryClient } from '@/lib/api/query-client';
import { router } from '@/lib/router';
import { enableMocking } from '@/mocks/utils/enable-mocking';
import './index.css';

enableMocking().then(() => {
  const rootElement = document.getElementById('root')!;
  if (!rootElement.innerHTML) {
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </StrictMode>,
    );
  }
});
