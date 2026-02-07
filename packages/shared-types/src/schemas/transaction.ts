import { z } from 'zod';

/**
 * Extended transaction types for all account types (brokers, banks, pensions)
 */
export const transactionTypeSchema = z.enum([
  // Investment transactions
  'buy',
  'sell',
  'dividend',
  'fee',
  'split',
  // Cash movements
  'deposit',
  'withdrawal',
  'transfer_in',
  'transfer_out',
  // Banking
  'interest',
  // Pension/Manual
  'contribution',
  'valuation',
  // FX
  'fx_conversion',
  // Other
  'other',
]);
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
  securityId: uuidSchema.optional(), // Optional: not needed for bank/pension transactions
  date: isoDateSchema,
  type: transactionTypeSchema,
  quantity: z.number().optional(), // Optional: not needed for cash transactions
  price: z.number().optional(), // Optional: not needed for cash transactions
  amount: z.number(), // Total amount (positive = inflow, negative = outflow)
  fees: z.number().optional(),
  currency: z.string().length(3, 'Currency must be exactly 3 characters').default('EUR'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  category: z.string().max(100, 'Category must be 100 characters or less').optional(),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
  externalId: z.string().max(100, 'External ID must be 100 characters or less').optional(),
  fingerprint: z.string().max(255, 'Fingerprint must be 255 characters or less').optional(),
});

export const updateTransactionSchema = z.object({
  date: isoDateSchema.optional(),
  type: transactionTypeSchema.optional(),
  quantity: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
  amount: z.number().optional(),
  fees: z.number().optional(),
  currency: z.string().length(3, 'Currency must be exactly 3 characters').optional(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .nullable()
    .optional(),
  category: z.string().max(100, 'Category must be 100 characters or less').nullable().optional(),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').nullable().optional(),
});

export const transactionFiltersSchema = z.object({
  accountId: uuidSchema.optional(),
  securityId: uuidSchema.optional(),
  type: transactionTypeSchema.optional(),
  types: z.array(transactionTypeSchema).optional(), // Filter by multiple types
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  category: z.string().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
});

/**
 * Transaction response schema (for API responses)
 */
export const transactionResponseSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  accountId: uuidSchema,
  securityId: uuidSchema.nullable(),
  date: z.string().datetime(),
  type: transactionTypeSchema,
  quantity: z.number().nullable(),
  price: z.number().nullable(),
  amount: z.number(),
  fees: z.number(),
  currency: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  notes: z.string().nullable(),
  externalId: z.string().nullable(),
  fingerprint: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Type inference from schemas
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionFiltersInput = z.infer<typeof transactionFiltersSchema>;
export type TransactionResponse = z.infer<typeof transactionResponseSchema>;
