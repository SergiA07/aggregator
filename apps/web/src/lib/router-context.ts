import type { QueryClient } from '@tanstack/react-query';

/**
 * Router context available to all routes via beforeLoad and loaders.
 *
 * We pass queryClient so routes can:
 * - Prefetch data in beforeLoad/loader
 * - Access cache outside React components
 */
export interface RouterContext {
  queryClient: QueryClient;
}
