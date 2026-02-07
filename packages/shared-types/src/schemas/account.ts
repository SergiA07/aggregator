import { z } from 'zod';

/**
 * Account types for unified account management
 */
export const accountTypeSchema = z.enum([
  'broker', // DeGiro, IBKR, Trade Republic
  'bank', // Sabadell, BBVA, Pibank
  'pension', // Caser, Indexa
  'crypto', // Kraken, Binance (future)
  'real_estate', // Properties (future)
  'other', // Manual/catch-all
]);
export type AccountType = z.infer<typeof accountTypeSchema>;

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
 * Account schemas for validation
 */
export const createAccountSchema = z.object({
  type: accountTypeSchema.default('broker'),
  institution: z
    .string()
    .min(1, 'Institution is required')
    .max(50, 'Institution must be 50 characters or less'),
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  externalId: z.string().max(100, 'External ID must be 100 characters or less').optional(),
  baseCurrency: z.string().length(3, 'Currency must be exactly 3 characters').default('EUR'),
  isActive: z.boolean().default(true),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(200, 'Name must be 200 characters or less').optional(),
  baseCurrency: z.string().length(3, 'Currency must be exactly 3 characters').optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
});

/**
 * Account balance schemas (multi-currency cash per account)
 */
export const accountBalanceSchema = z.object({
  id: uuidSchema,
  accountId: uuidSchema,
  currency: z.string().length(3, 'Currency must be exactly 3 characters'),
  balance: z.number(),
  updatedAt: z.string().datetime(),
});

export const upsertAccountBalanceSchema = z.object({
  currency: z.string().length(3, 'Currency must be exactly 3 characters'),
  balance: z.number(),
});

/**
 * Account response schema (for API responses)
 */
export const accountResponseSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  type: accountTypeSchema,
  institution: z.string(),
  name: z.string(),
  externalId: z.string().nullable(),
  baseCurrency: z.string(),
  isActive: z.boolean(),
  lastImportAt: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  balances: z.array(accountBalanceSchema).optional(),
});

/**
 * Valuation schema for pension/manual accounts
 * Creates a valuation transaction to track historical values
 */
export const addValuationSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  date: z
    .string()
    .datetime()
    .optional()
    .default(() => new Date().toISOString()),
  notes: z.string().max(500, 'Notes must be 500 characters or less').optional(),
});

/**
 * Account with YTD performance (for pension/manual accounts)
 */
export const accountWithPerformanceSchema = accountResponseSchema.extend({
  currentValue: z.number(),
  ytdStartValue: z.number().nullable(),
  ytdChange: z.number().nullable(),
  ytdChangePercent: z.number().nullable(),
  lastValuationAt: z.string().datetime().nullable(),
});

// Type inference from schemas
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type AccountBalance = z.infer<typeof accountBalanceSchema>;
export type UpsertAccountBalanceInput = z.infer<typeof upsertAccountBalanceSchema>;
export type AccountResponse = z.infer<typeof accountResponseSchema>;
export type AddValuationInput = z.infer<typeof addValuationSchema>;
export type AccountWithPerformance = z.infer<typeof accountWithPerformanceSchema>;
