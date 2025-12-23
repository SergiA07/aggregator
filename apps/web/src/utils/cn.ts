import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes safely (handles conflicts like "p-2 p-4" → "p-4")
 * Usage: cn('p-2', condition && 'text-red-500', 'font-bold')
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
