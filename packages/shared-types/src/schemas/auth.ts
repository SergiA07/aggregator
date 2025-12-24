import { z } from 'zod';

/**
 * Email validation regex
 */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Auth schemas for validation
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .regex(emailRegex, 'Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const signUpSchema = loginSchema.extend({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// Type inference from schemas
export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
