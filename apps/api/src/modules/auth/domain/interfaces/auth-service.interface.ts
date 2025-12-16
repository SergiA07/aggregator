import type { AuthUser } from './auth-user.interface';

/**
 * DI token for NestJS
 */
export const AUTH_SERVICE = 'AUTH_SERVICE';

/**
 * IAuthService Interface - Domain Layer
 *
 * Abstraction for authentication services. Allows swapping
 * between different auth providers (Supabase, Firebase, Auth0, JWT)
 * without modifying business logic.
 */
export interface IAuthService {
  /**
   * Verify a token and return the authenticated user
   * @param token - The authentication token (JWT, session token, etc.)
   * @returns The authenticated user or null if invalid
   */
  verifyToken(token: string): Promise<AuthUser | null>;

  /**
   * Check if the auth service is available/configured
   */
  isAvailable(): boolean;
}
