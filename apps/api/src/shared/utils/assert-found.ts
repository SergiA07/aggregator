import { NotFoundException } from '@nestjs/common';

/**
 * TypeScript assertion function that throws NotFoundException if value is null/undefined.
 *
 * Uses TypeScript's `asserts` keyword to narrow the type after the call,
 * eliminating the need for manual null checks in subsequent code.
 *
 * @example
 * const account = await this.accountsService.findOne(user.id, id);
 * assertFound(account, 'Account not found');
 * return account; // TypeScript knows account is non-null here
 */
export function assertFound<T>(
  value: T | null | undefined,
  message = 'Resource not found',
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundException(message);
  }
}
