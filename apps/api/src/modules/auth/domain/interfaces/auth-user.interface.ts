/**
 * AuthUser Interface - Domain Layer
 *
 * Represents an authenticated user. This abstraction allows
 * swapping auth providers (Supabase, Firebase, Auth0, etc.)
 * without changing the rest of the application.
 */
export interface AuthUser {
  id: string;
  email: string | undefined;
  metadata?: Record<string, unknown>;
}

/**
 * Create a dev user for development mode
 */
export function createDevUser(): AuthUser {
  return {
    id: 'dev-user-00000000-0000-0000-0000-000000000000',
    email: 'dev@localhost',
    metadata: {},
  };
}
