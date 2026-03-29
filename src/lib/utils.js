import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind classes without conflicts (shadcn-style).
 * @param {...import('clsx').ClassValue} inputs
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
