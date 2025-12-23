/**
 * MSW initialization for development mode
 *
 * Enable mocking when VITE_MOCK_API=true (bun dev:mock)
 * This allows running the frontend without a real backend
 */
export async function enableMocking() {
  if (import.meta.env.VITE_MOCK_API !== 'true') {
    return;
  }

  const { worker } = await import('../browser');
  return worker.start({
    onUnhandledRequest: 'bypass', // Don't warn for unhandled requests (assets, etc.)
  });
}
