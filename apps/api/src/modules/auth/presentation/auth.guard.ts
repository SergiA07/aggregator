import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import type { Env } from '@/shared/config';
import { AUTH_SERVICE, createDevUser, type IAuthService } from '../domain/interfaces';

/**
 * AuthGuard - Application Layer
 *
 * Generic auth guard that uses IAuthService abstraction.
 * Works with any auth provider implementing the interface.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly devBypassEnabled: boolean;

  constructor(
    @Inject(AUTH_SERVICE)
    private readonly authService: IAuthService,
    @InjectPinoLogger(AuthGuard.name) private readonly logger: PinoLogger,
    private readonly config: ConfigService<Env, true>,
  ) {
    // Check dev bypass once at construction time
    // Requires BOTH: NODE_ENV === 'development' AND AUTH_DEV_BYPASS === true
    this.devBypassEnabled =
      this.config.get('NODE_ENV') === 'development' && this.config.get('AUTH_DEV_BYPASS') === true;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Allow OPTIONS requests for CORS preflight
    if (request.method === 'OPTIONS') {
      return true;
    }

    const authHeader = request.headers.authorization;

    if (!authHeader) {
      if (this.devBypassEnabled) {
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
