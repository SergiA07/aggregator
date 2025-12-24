import { z } from 'zod';

/**
 * Account schemas for validation
 */

export const createAccountSchema = z.object({
  broker: z.string().min(1, 'Broker is required').max(50, 'Broker must be 50 characters or less'),
  accountId: z
    .string()
    .min(1, 'Account ID is required')
    .max(100, 'Account ID must be 100 characters or less'),
  accountName: z.string().max(200, 'Account name must be 200 characters or less').optional(),
  currency: z.string().max(3, 'Currency must be 3 characters or less').optional(),
});

export const updateAccountSchema = z.object({
  accountName: z.string().max(200, 'Account name must be 200 characters or less').optional(),
  currency: z.string().max(3, 'Currency must be 3 characters or less').optional(),
});

// Type inference from schemas
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
