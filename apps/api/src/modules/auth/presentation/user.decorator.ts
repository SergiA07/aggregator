import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../domain/interfaces';

/**
 * CurrentUser Decorator
 *
 * Extracts the authenticated user from the request.
 * Returns the generic AuthUser interface, not a provider-specific type.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
