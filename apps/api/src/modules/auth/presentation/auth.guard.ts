import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AUTH_SERVICE, createDevUser, type IAuthService } from '../domain/interfaces';

/**
 * AuthGuard - Application Layer
 *
 * Generic auth guard that uses IAuthService abstraction.
 * Works with any auth provider implementing the interface.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH_SERVICE)
    private readonly authService: IAuthService,
  ) {}

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
        request.user = createDevUser();
        return true;
      }
      throw new UnauthorizedException('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      if (isDev) {
        request.user = createDevUser();
        return true;
      }
      throw new UnauthorizedException('No token provided');
    }

    const user = await this.authService.verifyToken(token);

    if (!user) {
      if (isDev) {
        request.user = createDevUser();
        return true;
      }
      throw new UnauthorizedException('Invalid token');
    }

    // Attach user to request for use in controllers
    request.user = user;
    return true;
  }
}

// Keep backward compatibility alias
export { AuthGuard as SupabaseAuthGuard };
