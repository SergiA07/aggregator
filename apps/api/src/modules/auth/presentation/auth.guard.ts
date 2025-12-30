import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import { AUTH_SERVICE, createDevUser, type IAuthService } from '../domain/interfaces';

/**
 * Check if dev auth bypass is enabled.
 * Requires BOTH conditions:
 * 1. NODE_ENV === 'development'
 * 2. AUTH_DEV_BYPASS === 'true' (explicit opt-in)
 *
 * This prevents accidental auth bypass if NODE_ENV is misconfigured in production.
 */
function isDevAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.AUTH_DEV_BYPASS === 'true';
}

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
    @InjectPinoLogger(AuthGuard.name) private readonly logger: PinoLogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Allow OPTIONS requests for CORS preflight
    if (request.method === 'OPTIONS') {
      return true;
    }

    // Dev bypass requires explicit opt-in via AUTH_DEV_BYPASS=true
    const devBypassEnabled = isDevAuthBypassEnabled();

    const authHeader = request.headers.authorization;

    if (!authHeader) {
      if (devBypassEnabled) {
        // Use mock user in development (only when explicitly enabled)
        this.logger.debug('Auth bypassed: using dev user (no auth header)');
        request.user = createDevUser();
        return true;
      }
      this.logger.warn(
        { method: request.method, url: request.url, reason: 'missing_header' },
        'Auth failed',
      );
      throw new UnauthorizedException('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      this.logger.warn(
        { method: request.method, url: request.url, reason: 'empty_token' },
        'Auth failed',
      );
      throw new UnauthorizedException('No token provided');
    }

    const user = await this.authService.verifyToken(token);

    if (!user) {
      this.logger.warn(
        { method: request.method, url: request.url, reason: 'invalid_token' },
        'Auth failed',
      );
      throw new UnauthorizedException('Invalid token');
    }

    // Attach user to request for use in controllers
    request.user = user;
    return true;
  }
}

// Keep backward compatibility alias
export { AuthGuard as SupabaseAuthGuard };
