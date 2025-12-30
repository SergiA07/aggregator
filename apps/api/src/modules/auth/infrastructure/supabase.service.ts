import { Injectable } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '@/shared/config';
import type { AuthUser, IAuthService } from '../domain/interfaces';

/**
 * SupabaseAuthService - Infrastructure Layer
 *
 * Implements IAuthService using Supabase as the auth provider.
 * This is a concrete implementation that can be swapped for
 * FirebaseAuthService, Auth0AuthService, etc.
 */
@Injectable()
export class SupabaseAuthService implements IAuthService {
  private readonly client: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {
    const supabaseUrl = this.config.get('SUPABASE_URL');
    const supabaseKey = this.config.get('SUPABASE_SECRET_KEY');
    const nodeEnv = this.config.get('NODE_ENV');

    if (!supabaseUrl || !supabaseKey) {
      // In dev mode, we can skip Supabase client initialization
      if (nodeEnv === 'development') {
        console.warn('Supabase credentials not set, running in dev mode without auth');
        return;
      }
      // This should never happen - ConfigModule validates required vars in production
      throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get the raw Supabase client (for Supabase-specific operations)
   */
  getClient(): SupabaseClient | null {
    return this.client;
  }

  /**
   * Check if Supabase is configured and available
   */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Verify a JWT token and return the authenticated user
   */
  async verifyToken(token: string): Promise<AuthUser | null> {
    if (!this.client) {
      return null;
    }

    const { data, error } = await this.client.auth.getUser(token);

    if (error || !data.user) {
      return null;
    }

    // Map Supabase User to our AuthUser interface
    // Role comes from app_metadata (set by admin, not user-editable)
    const role = data.user.app_metadata?.role === 'admin' ? 'admin' : 'user';

    return {
      id: data.user.id,
      email: data.user.email,
      role,
      metadata: {
        ...data.user.user_metadata,
        ...data.user.app_metadata,
      },
    };
  }
}

// Keep backward compatibility alias
export { SupabaseAuthService as SupabaseService };
