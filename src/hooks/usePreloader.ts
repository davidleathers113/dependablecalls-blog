/**
 * Resource preloading hook optimized for React 19.1
 * Handles critical resource preloading and route prefetching
 */

import { useEffect, useRef, useCallback } from 'react'

interface PreloadOptions {
  as?: 'script' | 'style' | 'image' | 'font' | 'fetch' | 'document'
  crossorigin?: 'anonymous' | 'use-credentials'
  type?: string
  media?: string
  priority?: 'high' | 'low'
}

interface PreloadResult {
  preload: (href: string, options?: PreloadOptions) => void
  prefetch: (href: string) => void
  preloadRoute: (route: string) => void
  preloadImage: (src: string) => Promise<void>
  preloadFont: (href: string) => void
  isSupported: boolean
}

// Check browser support for various preload features
const getPreloadSupport = () => {
  if (typeof window === 'undefined') {
    return {
      preload: false,
      prefetch: false,
      modulePreload: false
    }
  }
  
  const link = document.createElement('link')
  return {
    preload: 'relList' in link && link.relList.supports?.('preload') === true,
    prefetch: 'relList' in link && link.relList.supports?.('prefetch') === true,
    modulePreload: 'relList' in link && link.relList.supports?.('modulepreload') === true
  }
}

export function usePreloader(): PreloadResult {
  const preloadedResources = useRef<Set<string>>(new Set())
  const prefetchedRoutes = useRef<Set<string>>(new Set())
  const support = useRef(getPreloadSupport())

  // Generic preload function
  const preload = useCallback((href: string, options: PreloadOptions = {}) => {
    if (!support.current.preload || preloadedResources.current.has(href)) {
      return
    }

    const {
      as = 'fetch',
      crossorigin,
      type,
      media,
      priority = 'high'
    } = options

    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = href
    link.as = as
    
    if (crossorigin) link.crossOrigin = crossorigin
    if (type) link.type = type
    if (media) link.media = media
    if (priority === 'high') link.fetchPriority = 'high'

    // Add error handling
    link.onerror = () => {
      console.warn(`Failed to preload resource: ${href}`)
      preloadedResources.current.delete(href)
    }

    link.onload = () => {
      console.log(`Successfully preloaded: ${href}`)
    }

    document.head.appendChild(link)
    preloadedResources.current.add(href)
  }, [])

  // Prefetch for lower priority resources
  const prefetch = useCallback((href: string) => {
    if (!support.current.prefetch || preloadedResources.current.has(href)) {
      return
    }

    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = href

    link.onerror = () => {
      console.warn(`Failed to prefetch resource: ${href}`)
    }

    document.head.appendChild(link)
    preloadedResources.current.add(href)
  }, [])

  // Preload route chunks
  const preloadRoute = useCallback((route: string) => {
    if (prefetchedRoutes.current.has(route)) {
      return
    }

    // This would need to be integrated with your router's chunk mapping
    // For now, we'll use a simple prefetch approach
    prefetch(route)
    prefetchedRoutes.current.add(route)
  }, [prefetch])

  // Preload images with Promise support
  const preloadImage = useCallback((src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (preloadedResources.current.has(src)) {
        resolve()
        return
      }

      const img = new Image()
      img.onload = () => {
        preloadedResources.current.add(src)
        resolve()
      }
      img.onerror = () => {
        reject(new Error(`Failed to preload image: ${src}`))
      }
      img.src = src
    })
  }, [])

  // Preload fonts
  const preloadFont = useCallback((href: string) => {
    preload(href, {
      as: 'font',
      crossorigin: 'anonymous',
      type: 'font/woff2'
    })
  }, [preload])

  // Cleanup on unmount
  useEffect(() => {
    // Capture the current resources at effect setup time
    const currentResources = preloadedResources.current
    
    return () => {
      // Clean up preload links on unmount using captured resources
      const links = document.querySelectorAll('link[rel="preload"], link[rel="prefetch"]')
      links.forEach(link => {
        const href = (link as HTMLLinkElement).href
        if (currentResources.has(href)) {
          link.remove()
        }
      })
    }
  }, [])

  return {
    preload,
    prefetch,
    preloadRoute,
    preloadImage,
    preloadFont,
    isSupported: support.current.preload || support.current.prefetch
  }
}

/**
 * Hook for critical resource preloading
 */
export function useCriticalPreload(resources: Array<{ href: string; options?: PreloadOptions }>) {
  const { preload, isSupported } = usePreloader()

  useEffect(() => {
    if (!isSupported) return

    // Preload critical resources immediately
    resources.forEach(({ href, options }) => {
      preload(href, { priority: 'high', ...options })
    })
  }, [preload, isSupported, resources])
}

/**
 * Hook for route prefetching on hover
 */
export function useRoutePrefetch() {
  const { preloadRoute } = usePreloader()
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const prefetchOnHover = useCallback((route: string, delay: number = 100) => {
    return {
      onMouseEnter: () => {
        timeoutRef.current = setTimeout(() => {
          preloadRoute(route)
        }, delay)
      },
      onMouseLeave: () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
      }
    }
  }, [preloadRoute])

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { prefetchOnHover, preloadRoute }
}

export default usePreloader