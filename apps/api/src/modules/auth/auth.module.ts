import { Global, Module } from '@nestjs/common';
import { AUTH_SERVICE } from './domain/interfaces';
import { SupabaseAuthService, SupabaseService } from './infrastructure/supabase.service';
import { AuthGuard, SupabaseAuthGuard } from './presentation/auth.guard';

/**
 * AuthModule - Infrastructure Layer
 *
 * Provides authentication services using dependency injection.
 * The AUTH_SERVICE token maps to SupabaseAuthService by default,
 * but can be easily swapped for another implementation.
 *
 * To use a different auth provider:
 * 1. Create a new service implementing IAuthService (e.g., FirebaseAuthService)
 * 2. Change the useClass binding below
 */
@Global()
@Module({
  providers: [
    // Interface binding - maps AUTH_SERVICE token to Supabase implementation
    { provide: AUTH_SERVICE, useClass: SupabaseAuthService },
    // Guard that uses the abstract interface
    AuthGuard,
    // Backward compatibility - keep concrete service available
    SupabaseAuthService,
  ],
  exports: [
    // Export interface token for other modules
    AUTH_SERVICE,
    AuthGuard,
    // Backward compatibility aliases
    SupabaseAuthService,
    { provide: SupabaseService, useExisting: SupabaseAuthService },
    { provide: SupabaseAuthGuard, useExisting: AuthGuard },
  ],
})
export class AuthModule {}
