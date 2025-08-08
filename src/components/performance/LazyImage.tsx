/**
 * Optimized lazy loading image component with React 19.1 features
 * Uses intersection observer, modern image formats, and performance tracking
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  placeholder?: 'blur' | 'skeleton' | 'none'
  priority?: boolean
  sizes?: string
  srcSet?: string
  onLoad?: () => void
  onError?: (error: Error) => void
  loading?: 'lazy' | 'eager'
  decoding?: 'async' | 'sync' | 'auto'
  fetchpriority?: 'high' | 'low' | 'auto'
}

// Generate WebP/AVIF sources for better compression
const generateModernSources = (src: string, srcSet?: string) => {
  if (!srcSet) {
    return {
      avif: src.replace(/\.(jpg|jpeg|png)$/i, '.avif'),
      webp: src.replace(/\.(jpg|jpeg|png)$/i, '.webp'),
      original: src
    }
  }
  
  return {
    avif: srcSet.replace(/\.(jpg|jpeg|png)/gi, '.avif'),
    webp: srcSet.replace(/\.(jpg|jpeg|png)/gi, '.webp'), 
    original: srcSet
  }
}

// Create blur data URL for placeholder
const createBlurDataUrl = (): string => {
  const svg = `
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f3f4f6;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#e5e7eb;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#d1d5db;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" fill="url(#grad)" />
    </svg>
  `
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export const LazyImage: React.FC<LazyImageProps> = React.memo(({
  src,
  alt,
  className = '',
  placeholder = 'blur',
  priority = false,
  sizes,
  srcSet,
  onLoad,
  onError,
  loading = 'lazy',
  decoding = 'async',
  fetchpriority = 'auto'
}) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const [retryCount, setRetryCount] = useState(0)
  
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadStartTime = useRef<number>(0)
  
  const sources = generateModernSources(src, srcSet)
  const blurDataUrl = placeholder === 'blur' ? createBlurDataUrl() : undefined

  // Handle image load with performance tracking
  const handleLoad = useCallback(() => {
    const loadTime = performance.now() - loadStartTime.current
    
    setIsLoaded(true)
    setIsError(false)
    
    // Track performance metrics
    if (loadTime > 0) {
      performance.mark('image-loaded')
      performance.measure('image-load-time', 'image-start', 'image-loaded')
    }
    
    onLoad?.()
  }, [onLoad])

  // Handle image error with retry logic
  const handleError = useCallback((_event: React.SyntheticEvent<HTMLImageElement>) => {
    if (retryCount < 2) {
      // Retry with exponential backoff
      const delay = Math.pow(2, retryCount) * 1000
      setTimeout(() => {
        setRetryCount(prev => prev + 1)
        if (imgRef.current) {
          imgRef.current.src = `${src}?retry=${Date.now()}`
        }
      }, delay)
    } else {
      setIsError(true)
      const error = new Error(`Failed to load image: ${src}`)
      onError?.(error)
    }
  }, [src, retryCount, onError])

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !containerRef.current) {
      setIsInView(true)
      return
    }

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observerRef.current?.disconnect()
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.1
      }
    )

    observerRef.current.observe(containerRef.current)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [priority])

  // Track load start time
  useEffect(() => {
    if (isInView && !isLoaded) {
      loadStartTime.current = performance.now()
      performance.mark('image-start')
    }
  }, [isInView, isLoaded])

  const containerClasses = [
    'relative overflow-hidden bg-gray-100',
    className
  ].filter(Boolean).join(' ')

  const imageClasses = [
    'w-full h-full object-cover transition-all duration-300',
    isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105',
    placeholder === 'blur' && !isLoaded ? 'blur-sm' : ''
  ].filter(Boolean).join(' ')

  // Error state
  if (isError) {
    return (
      <div className={containerClasses}>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
          <ExclamationTriangleIcon className="w-8 h-8 mb-2" />
          <p className="text-sm">Failed to load image</p>
          <button 
            onClick={() => {
              setIsError(false)
              setRetryCount(0)
              setIsLoaded(false)
            }}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <ArrowPathIcon className="w-3 h-3" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={containerClasses}>
      {/* Blur placeholder */}
      {placeholder === 'blur' && blurDataUrl && (
        <img
          src={blurDataUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
        />
      )}
      
      {/* Skeleton loader */}
      {placeholder === 'skeleton' && !isLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse">
          <div className="w-full h-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200" />
        </div>
      )}

      {/* Main image with modern format support */}
      {isInView && (
        <picture>
          {/* AVIF support */}
          <source srcSet={sources.avif} type="image/avif" sizes={sizes} />
          
          {/* WebP support */}
          <source srcSet={sources.webp} type="image/webp" sizes={sizes} />
          
          {/* Fallback */}
          <img
            ref={imgRef}
            src={src}
            srcSet={sources.original}
            alt={alt}
            className={imageClasses}
            loading={loading}
            decoding={decoding}
            fetchPriority={fetchpriority}
            sizes={sizes}
            onLoad={handleLoad}
            onError={handleError}
          />
        </picture>
      )}

      {/* Loading indicator */}
      {!isLoaded && !isError && isInView && placeholder === 'none' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
})

LazyImage.displayName = 'LazyImage'

export default LazyImage