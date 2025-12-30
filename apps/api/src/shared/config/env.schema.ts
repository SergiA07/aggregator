import { z } from 'zod';

/**
 * Environment variable schema with Zod validation.
 *
 * All environment variables are validated at application startup.
 * If validation fails, the app throws an error immediately (fail-fast).
 *
 * @see https://docs.nestjs.com/techniques/configuration#custom-validate-function
 */
export const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().positive().default(3333),

  // Database (required)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Supabase Auth
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL').optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),

  // CORS - required in production
  FRONTEND_URL: z.string().url().optional(),

  // Development settings - transforms 'true' string to boolean
  AUTH_DEV_BYPASS: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true'),
});

/**
 * Inferred type for validated environment variables.
 * Use this type when injecting ConfigService for type safety.
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables using Zod schema.
 * Called by ConfigModule.forRoot() at startup.
 *
 * @throws ZodError if validation fails
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    // Zod v4 uses .issues instead of .errors
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  // Additional cross-field validation
  const env = result.data;

  // In production, require Supabase credentials
  if (env.NODE_ENV === 'production') {
    if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required in production');
    }
    if (!env.FRONTEND_URL) {
      throw new Error('FRONTEND_URL is required in production');
    }
  }

  return env;
}
