/**
 * Optimized intersection observer hook for React 19.1
 * Provides efficient viewport detection with cleanup
 */

import { useEffect, useRef, useState, useCallback } from 'react'

interface UseIntersectionObserverOptions {
  threshold?: number | number[]
  root?: Element | null
  rootMargin?: string
  freezeOnceVisible?: boolean
  initialIsIntersecting?: boolean
  onIntersect?: (entry: IntersectionObserverEntry) => void
}

interface UseIntersectionObserverReturn {
  ref: React.RefCallback<Element>
  isIntersecting: boolean
  entry: IntersectionObserverEntry | undefined
}

export function useIntersectionObserver({
  threshold = 0.1,
  root = null,
  rootMargin = '0px',
  freezeOnceVisible = false,
  initialIsIntersecting = false,
  onIntersect
}: UseIntersectionObserverOptions = {}): UseIntersectionObserverReturn {
  const [entry, setEntry] = useState<IntersectionObserverEntry>()
  const [isIntersecting, setIsIntersecting] = useState(initialIsIntersecting)
  const [element, setElement] = useState<Element | null>(null)
  
  const observerRef = useRef<IntersectionObserver | undefined>(undefined)
  
  const ref = useCallback((element: Element | null) => {
    setElement(element)
  }, [])

  useEffect(() => {
    if (!element || !('IntersectionObserver' in window)) {
      return
    }

    // Don't re-observe if frozen and already visible
    if (freezeOnceVisible && isIntersecting) {
      return
    }

    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        const isElementIntersecting = entry.isIntersecting
        
        setEntry(entry)
        setIsIntersecting(isElementIntersecting)
        
        // Call callback if provided
        onIntersect?.(entry)
        
        // Freeze observation if element becomes visible and freezeOnceVisible is true
        if (freezeOnceVisible && isElementIntersecting && observerRef.current) {
          observerRef.current.disconnect()
        }
      },
      {
        threshold,
        root,
        rootMargin
      }
    )

    observerRef.current.observe(element)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [
    element,
    threshold,
    root,
    rootMargin,
    freezeOnceVisible,
    isIntersecting,
    onIntersect
  ])

  return {
    ref,
    isIntersecting,
    entry
  }
}

/**
 * Simplified hook for basic visibility detection
 */
export function useIsVisible(options?: Omit<UseIntersectionObserverOptions, 'onIntersect'>) {
  const { isIntersecting, ref } = useIntersectionObserver({
    freezeOnceVisible: true,
    ...options
  })
  
  return { isVisible: isIntersecting, ref }
}

/**
 * Hook for lazy loading with performance tracking
 */
export function useLazyLoad(
  callback: () => void,
  options?: UseIntersectionObserverOptions
) {
  const hasLoaded = useRef(false)
  const loadStart = useRef<number>(0)
  
  const { isIntersecting, ref } = useIntersectionObserver({
    freezeOnceVisible: true,
    onIntersect: (entry) => {
      if (entry.isIntersecting && !hasLoaded.current) {
        loadStart.current = performance.now()
        hasLoaded.current = true
        callback()
        
        // Track lazy load performance
        requestAnimationFrame(() => {
          const loadTime = performance.now() - loadStart.current
          if (loadTime > 0) {
            performance.mark('lazy-load-complete')
            performance.measure('lazy-load-time', { 
              start: loadStart.current,
              end: performance.now()
            })
          }
        })
      }
    },
    ...options
  })
  
  return {
    ref,
    isLoaded: hasLoaded.current,
    isIntersecting
  }
}

export default useIntersectionObserver