import React, { useEffect, useState } from 'react'

/**
 * Hook to detect if the user prefers reduced motion
 * @returns boolean indicating if reduced motion is preferred
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches)

    // Create event listener
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    // Add event listener
    mediaQuery.addEventListener('change', handleChange)

    // Clean up
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return prefersReducedMotion
}

/**
 * Get a CSS class that respects motion preferences
 * @param motionClass - The class to apply when motion is allowed
 * @param reducedMotionClass - The class to apply when reduced motion is preferred
 * @returns The appropriate class based on user preference
 */
export function getMotionSafeClass(
  motionClass: string,
  reducedMotionClass: string = ''
): string {
  if (typeof window === 'undefined') return reducedMotionClass
  
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return prefersReducedMotion ? reducedMotionClass : motionClass
}

/**
 * Higher-order component that provides motion-safe props
 * @param Component - The component to wrap
 * @returns A wrapped component that respects motion preferences
 */
export function withReducedMotion<T extends Record<string, any>>(
  Component: React.ComponentType<T>
) {
  return function MotionSafeComponent(props: T) {
    const prefersReducedMotion = useReducedMotion()
    
    return <Component {...props} prefersReducedMotion={prefersReducedMotion} />
  }
}