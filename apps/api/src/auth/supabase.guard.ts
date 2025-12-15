import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

// Mock user for development mode
const DEV_USER = {
  id: 'dev-user-00000000-0000-0000-0000-000000000000',
  email: 'dev@localhost',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Allow OPTIONS requests for CORS preflight
    if (request.method === 'OPTIONS') {
      return true;
    }

    // Development mode bypass - use mock user when no auth header and in dev mode
    const isDev = process.env.DEV_MODE === 'true';

    const authHeader = request.headers.authorization;

    if (!authHeader) {
      if (isDev) {
        // Use mock user in development
        request.user = DEV_USER;
        return true;
      }
      throw new UnauthorizedException('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      if (isDev) {
        request.user = DEV_USER;
        return true;
      }
      throw new UnauthorizedException('No token provided');
    }

    const user = await this.supabase.verifyToken(token);

    if (!user) {
      if (isDev) {
        request.user = DEV_USER;
        return true;
      }
      throw new UnauthorizedException('Invalid token');
    }

    // Attach user to request for use in controllers
    request.user = user;
    return true;
  }
}
