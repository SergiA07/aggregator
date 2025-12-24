import { z } from 'zod';

/**
 * Security schemas for validation
 */

export const createSecuritySchema = z.object({
  symbol: z.string().min(1, 'Symbol is required').max(20, 'Symbol must be 20 characters or less'),
  isin: z.string().max(12, 'ISIN must be 12 characters or less').optional(),
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  securityType: z
    .string()
    .min(1, 'Security type is required')
    .max(20, 'Security type must be 20 characters or less'),
  currency: z.string().max(3, 'Currency must be 3 characters or less').optional(),
  exchange: z.string().max(50, 'Exchange must be 50 characters or less').optional(),
  sector: z.string().max(100, 'Sector must be 100 characters or less').optional(),
  industry: z.string().max(100, 'Industry must be 100 characters or less').optional(),
  country: z.string().max(2, 'Country must be 2 characters or less').optional(),
});

export const updateSecuritySchema = z.object({
  symbol: z.string().max(20, 'Symbol must be 20 characters or less').optional(),
  name: z.string().max(200, 'Name must be 200 characters or less').optional(),
  securityType: z.string().max(20, 'Security type must be 20 characters or less').optional(),
  currency: z.string().max(3, 'Currency must be 3 characters or less').optional(),
  exchange: z.string().max(50, 'Exchange must be 50 characters or less').optional(),
  sector: z.string().max(100, 'Sector must be 100 characters or less').optional(),
  industry: z.string().max(100, 'Industry must be 100 characters or less').optional(),
  country: z.string().max(2, 'Country must be 2 characters or less').optional(),
});

// Type inference from schemas
export type CreateSecurityInput = z.infer<typeof createSecuritySchema>;
export type UpdateSecurityInput = z.infer<typeof updateSecuritySchema>;
