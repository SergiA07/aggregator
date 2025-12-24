import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { z } from 'zod';

/**
 * NestJS pipe for Zod schema validation
 *
 * Usage:
 * @UsePipes(new ZodValidationPipe(createAccountSchema))
 * async create(@Body() dto: CreateAccountInput) { ... }
 *
 * Or as a parameter decorator:
 * async create(@Body(new ZodValidationPipe(createAccountSchema)) dto: CreateAccountInput) { ... }
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const flattened = z.flattenError(result.error);

      // Format errors for API response
      const errors = Object.entries(flattened.fieldErrors).map(([field, messages]) => ({
        field,
        messages: messages as string[],
      }));

      throw new BadRequestException({
        message: 'Validation failed',
        errors,
        formErrors: flattened.formErrors,
      });
    }

    return result.data;
  }
}
