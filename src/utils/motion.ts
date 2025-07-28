/**
 * Check if user prefers reduced motion
 */
export function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export const prefersReducedMotion = getPrefersReducedMotion()