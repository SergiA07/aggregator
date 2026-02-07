/**
 * User roles for authorization
 */
export type UserRole = 'user' | 'admin';

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
  role: UserRole;
  metadata?: Record<string, unknown>;
}

/**
 * Create a dev user for development mode
 * Dev user is admin by default for convenience
 */
export function createDevUser(): AuthUser {
  return {
    // Use test user ID for local development
    id: 'a26043e1-b282-49ae-9614-3fbfd33b00b2',
    email: 'dev@localhost',
    role: 'admin',
    metadata: {},
  };
}
