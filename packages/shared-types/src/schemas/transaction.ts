import { z } from 'zod';

/**
 * Transaction type enum as Zod enum
 */
export const transactionTypeSchema = z.enum(['buy', 'sell', 'dividend', 'fee', 'split', 'other']);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

/**
 * UUID validation helper
 */
const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'Invalid UUID format',
  );

/**
 * ISO date string validation
 */
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

/**
 * Transaction schemas for validation
 */
export const createTransactionSchema = z.object({
  accountId: uuidSchema,
  securityId: uuidSchema,
  date: isoDateSchema,
  type: transactionTypeSchema,
  quantity: z.number(),
  price: z.number(),
  amount: z.number(),
  fees: z.number().optional(),
  currency: z.string().max(3, 'Currency must be 3 characters or less').optional(),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
  externalId: z.string().max(100, 'External ID must be 100 characters or less').optional(),
});

export const updateTransactionSchema = z.object({
  date: isoDateSchema.optional(),
  type: transactionTypeSchema.optional(),
  quantity: z.number().optional(),
  price: z.number().optional(),
  amount: z.number().optional(),
  fees: z.number().optional(),
  currency: z.string().max(3, 'Currency must be 3 characters or less').optional(),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
});

export const transactionFiltersSchema = z.object({
  accountId: uuidSchema.optional(),
  securityId: uuidSchema.optional(),
  type: transactionTypeSchema.optional(),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
});

// Type inference from schemas
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionFiltersInput = z.infer<typeof transactionFiltersSchema>;
