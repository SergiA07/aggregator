import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import type { AuthUser } from '../domain/interfaces';

/**
 * AdminGuard - Requires user to have admin role
 *
 * Use after AuthGuard to restrict endpoints to admin users only.
 * Example: @UseGuards(SupabaseAuthGuard, AdminGuard)
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@InjectPinoLogger(AdminGuard.name) private readonly logger: PinoLogger) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role !== 'admin') {
      this.logger.warn(
        { userId: user.id, role: user.role, method: request.method, url: request.url },
        'Admin access denied',
      );
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
