import React, { useState, useRef, useCallback, useEffect } from 'react'
import { EyeIcon, ExclamationTriangleIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline'
import { trackMetric } from '../../lib/apm'
import { 
  transformSupabaseImage, 
  createLQIP, 
  createSrcSet, 
  createSizesAttribute,
  getBestImageFormat,
  isSupabaseStorageUrl
} from '../../lib/blog-images'

// Aspect ratio presets
export type AspectRatio = '16:9' | '4:3' | '1:1' | 'auto' | 'custom'

// Loading states
export type LoadingState = 'idle' | 'loading' | 'loaded' | 'error'

// Image sizes for responsive support
export interface ImageSize {
  width: number
  height?: number
  quality?: number
}

// Performance metrics
export interface ImagePerformanceMetrics {
  loadStartTime: number
  loadEndTime?: number
  loadDuration?: number
  imageSize?: number
  cacheHit?: boolean
  retryCount?: number
}

// Error handling configuration
export interface ErrorConfig {
  fallbackSrc?: string
  maxRetries?: number
  retryDelay?: number
  showErrorState?: boolean
}

// Lightbox configuration
export interface LightboxConfig {
  enabled?: boolean
  showZoomIcon?: boolean
  onOpen?: () => void
  onClose?: () => void
}

// Blur placeholder configuration
export interface BlurConfig {
  enabled?: boolean
  blurDataUrl?: string
  blurAmount?: number
  transitionDuration?: number
}

// Main component props
export interface BlogLazyImageProps {
  // Required props
  src: string
  alt: string
  
  // Optional display props
  aspectRatio?: AspectRatio
  customAspectRatio?: string // e.g., "3:2", "21:9"
  className?: string
  
  // Responsive image support
  sizes?: ImageSize[]
  defaultSize?: ImageSize
  
  // Loading and placeholder
  placeholder?: 'blur' | 'skeleton' | 'none'
  blurConfig?: BlurConfig
  
  // Error handling
  errorConfig?: ErrorConfig
  
  // Accessibility
  loading?: 'lazy' | 'eager'
  role?: string
  ariaLabel?: string
  ariaDescribedBy?: string
  
  // Performance
  priority?: boolean
  fetchPriority?: 'high' | 'low' | 'auto'
  decoding?: 'async' | 'sync' | 'auto'
  
  // Interactions
  lightbox?: LightboxConfig
  onClick?: (event: React.MouseEvent<HTMLImageElement>) => void
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void
  onError?: (event: React.SyntheticEvent<HTMLImageElement>) => void
  
  // Performance monitoring
  onPerformanceMetrics?: (metrics: ImagePerformanceMetrics) => void
}

// Aspect ratio CSS classes
const aspectRatioClasses: Record<AspectRatio, string> = {
  '16:9': 'aspect-video',
  '4:3': 'aspect-[4/3]',
  '1:1': 'aspect-square',
  'auto': '',
  'custom': ''
}

// Validate and sanitize image URL
const validateImageUrl = (src: string): boolean => {
  try {
    new URL(src, window.location.origin)
    return true
  } catch {
    return false
  }
}

// Create blur data URL for placeholder
const createBlurDataUrl = (width: number = 40, height: number = 40): string => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  canvas.width = width
  canvas.height = height
  
  if (ctx) {
    // Create a subtle gradient for blur effect
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#f3f4f6')
    gradient.addColorStop(0.5, '#e5e7eb')
    gradient.addColorStop(1, '#d1d5db')
    
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }
  
  return canvas.toDataURL('image/jpeg', 0.1)
}

export function BlogLazyImage({
  src,
  alt,
  aspectRatio = 'auto',
  customAspectRatio,
  className = '',
  sizes = [],
  defaultSize = { width: 800, quality: 80 },
  placeholder = 'blur',
  blurConfig = { enabled: true, blurAmount: 20, transitionDuration: 300 },
  errorConfig = { maxRetries: 3, retryDelay: 1000, showErrorState: true },
  loading = 'lazy',
  role,
  ariaLabel,
  ariaDescribedBy,
  priority = false,
  fetchPriority = 'auto',
  decoding = 'async',
  lightbox = { enabled: false, showZoomIcon: false },
  onClick,
  onLoad,
  onError,
  onPerformanceMetrics
}: BlogLazyImageProps) {
  // State management
  const [loadingState, setLoadingState] = useState<LoadingState>('idle')
  const [imageSrc, setImageSrc] = useState<string>('')
  const [retryCount, setRetryCount] = useState(0)
  const [showLightbox, setShowLightbox] = useState(false)
  const [performanceMetrics, setPerformanceMetrics] = useState<ImagePerformanceMetrics>({
    loadStartTime: 0,
    retryCount: 0
  })
  
  // Refs
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  
  // Validate src prop
  const isValidSrc = validateImageUrl(src)
  
  // Generate optimized image URLs using blog-images utilities
  const getOptimizedSrc = useCallback((originalSrc: string, size: ImageSize) => {
    if (isSupabaseStorageUrl(originalSrc)) {
      return transformSupabaseImage(originalSrc, {
        width: size.width,
        height: size.height,
        quality: size.quality || 80,
        format: getBestImageFormat()
      })
    }
    return originalSrc
  }, [])
  
  // Generate responsive srcSet and sizes
  const srcSet = sizes.length > 0 ? createSrcSet(src, sizes.map(s => s.width)) : ''
  const sizesAttr = sizes.length > 0 ? createSizesAttribute() : ''
  
  // Create blur placeholder using blog-images utility
  const blurDataUrl = blurConfig.enabled && placeholder === 'blur' 
    ? blurConfig.blurDataUrl || (isSupabaseStorageUrl(src) ? createLQIP(src) : createBlurDataUrl())
    : ''
  
  // Handle image loading with performance tracking
  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const endTime = performance.now()
    const metrics: ImagePerformanceMetrics = {
      ...performanceMetrics,
      loadEndTime: endTime,
      loadDuration: endTime - performanceMetrics.loadStartTime,
      imageSize: imageRef.current?.naturalWidth ? 
        imageRef.current.naturalWidth * imageRef.current.naturalHeight : undefined,
      cacheHit: endTime - performanceMetrics.loadStartTime < 50 // Rough cache detection
    }
    
    setPerformanceMetrics(metrics)
    setLoadingState('loaded')
    
    // Track performance metrics
    if (metrics.loadDuration) {
      trackMetric('image_load_time', metrics.loadDuration, {
        src: src.substring(0, 100), // Truncate for privacy
        cached: metrics.cacheHit,
        retries: metrics.retryCount
      })
    }
    
    // Call performance callback
    if (onPerformanceMetrics) {
      onPerformanceMetrics(metrics)
    }
    
    // Call user-provided onLoad
    if (onLoad) {
      onLoad(event)
    }
  }, [performanceMetrics, onPerformanceMetrics, onLoad, src])
  
  // Handle image error with retry logic
  const handleImageError = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const shouldRetry = retryCount < (errorConfig.maxRetries || 3)
    
    if (shouldRetry) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1)
        setPerformanceMetrics(prev => ({
          ...prev,
          retryCount: prev.retryCount + 1
        }))
        setLoadingState('loading')
        
        // Force reload by adding timestamp
        const optimizedSrc = getOptimizedSrc(src, defaultSize)
        const url = new URL(optimizedSrc, window.location.origin)
        url.searchParams.set('retry', Date.now().toString())
        setImageSrc(url.toString())
      }, errorConfig.retryDelay || 1000)
    } else {
      setLoadingState('error')
      
      // Use fallback image if provided
      if (errorConfig.fallbackSrc) {
        setImageSrc(errorConfig.fallbackSrc)
        setLoadingState('loading')
      }
    }
    
    // Call user-provided onError
    if (onError) {
      onError(event)
    }
  }, [retryCount, errorConfig, onError, src, getOptimizedSrc, defaultSize])
  
  // Handle lightbox toggle
  const handleLightboxToggle = useCallback(() => {
    if (!lightbox.enabled) return
    
    setShowLightbox(prev => {
      const newState = !prev
      if (newState && lightbox.onOpen) {
        lightbox.onOpen()
      } else if (!newState && lightbox.onClose) {
        lightbox.onClose()
      }
      return newState
    })
  }, [lightbox])
  
  // Handle click events
  const handleClick = useCallback((event: React.MouseEvent<HTMLImageElement>) => {
    if (lightbox.enabled) {
      event.preventDefault()
      handleLightboxToggle()
    }
    
    if (onClick) {
      onClick(event)
    }
  }, [lightbox.enabled, handleLightboxToggle, onClick])
  
  // Handle keyboard events for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (lightbox.enabled && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      handleLightboxToggle()
    }
  }, [lightbox.enabled, handleLightboxToggle])
  
  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!containerRef.current || priority || loading === 'eager') {
      // Load immediately if priority or eager loading
      setLoadingState('loading')
      const optimizedSrc = getOptimizedSrc(src, defaultSize)
      setImageSrc(optimizedSrc)
      setPerformanceMetrics(prev => ({
        ...prev,
        loadStartTime: performance.now()
      }))
      return
    }
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && loadingState === 'idle') {
            setLoadingState('loading')
            const optimizedSrc = getOptimizedSrc(src, defaultSize)
            setImageSrc(optimizedSrc)
            setPerformanceMetrics(prev => ({
              ...prev,
              loadStartTime: performance.now()
            }))
            
            // Disconnect observer after loading starts
            if (observerRef.current) {
              observerRef.current.disconnect()
            }
          }
        })
      },
      {
        root: null,
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.1
      }
    )
    
    observerRef.current.observe(containerRef.current)
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [src, priority, loading, loadingState, getOptimizedSrc, defaultSize])
  
  // Generate container classes
  const containerClasses = [
    'relative overflow-hidden bg-gray-100',
    aspectRatio !== 'auto' && aspectRatio !== 'custom' ? aspectRatioClasses[aspectRatio] : '',
    aspectRatio === 'custom' && customAspectRatio ? `aspect-[${customAspectRatio}]` : '',
    lightbox.enabled ? 'cursor-pointer group focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2' : '',
    className
  ].filter(Boolean).join(' ')
  
  // Generate image classes
  const imageClasses = [
    'w-full h-full object-cover transition-all duration-300',
    loadingState === 'loaded' ? 'opacity-100' : 'opacity-0',
    blurConfig.enabled && loadingState !== 'loaded' ? `blur-[${blurConfig.blurAmount || 20}px]` : '',
    lightbox.enabled ? 'group-hover:scale-105' : ''
  ].filter(Boolean).join(' ')
  
  // Error state component
  const ErrorState = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
      <div className="text-center text-gray-500">
        <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-2" />
        <p className="text-sm">Failed to load image</p>
        {retryCount > 0 && (
          <p className="text-xs mt-1">Retried {retryCount} times</p>
        )}
      </div>
    </div>
  )
  
  // Skeleton loader component
  const SkeletonLoader = () => (
    <div className="absolute inset-0 bg-gray-200 animate-pulse">
      <div className="w-full h-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-shimmer" />
    </div>
  )
  
  // Lightbox component
  const Lightbox = () => showLightbox && (
    <div 
      className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
      onClick={handleLightboxToggle}
      role="dialog"
      aria-modal="true"
      aria-label="Image lightbox"
    >
      <div className="relative max-w-full max-h-full">
        <img
          src={imageSrc}
          alt={alt}
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          className="absolute top-4 right-4 text-white text-xl font-bold w-8 h-8 flex items-center justify-center bg-black bg-opacity-50 rounded-full hover:bg-opacity-75 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
          onClick={handleLightboxToggle}
          aria-label="Close lightbox"
        >
          ×
        </button>
      </div>
    </div>
  )
  
  if (!isValidSrc) {
    return <ErrorState />
  }
  
  return (
    <>
      <div 
        ref={containerRef}
        className={containerClasses}
        role={role}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        tabIndex={lightbox.enabled ? 0 : undefined}
        onKeyDown={handleKeyDown}
      >
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
        {placeholder === 'skeleton' && loadingState === 'loading' && (
          <SkeletonLoader />
        )}
        
        {/* Main image */}
        {imageSrc && (
          <img
            ref={imageRef}
            src={imageSrc}
            srcSet={srcSet || undefined}
            sizes={sizesAttr || undefined}
            alt={alt}
            className={imageClasses}
            loading={loading}
            fetchPriority={fetchPriority}
            decoding={decoding}
            onLoad={handleImageLoad}
            onError={handleImageError}
            onClick={handleClick}
          />
        )}
        
        {/* Loading indicator */}
        {loadingState === 'loading' && placeholder === 'none' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        )}
        
        {/* Error state */}
        {loadingState === 'error' && errorConfig.showErrorState && (
          <ErrorState />
        )}
        
        {/* Zoom icon for lightbox */}
        {lightbox.enabled && lightbox.showZoomIcon && loadingState === 'loaded' && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-30">
            <ArrowsPointingOutIcon className="w-8 h-8 text-white" />
          </div>
        )}
        
        {/* View count indicator (optional) */}
        {loadingState === 'loaded' && (
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <EyeIcon className="w-3 h-3" />
              View
            </div>
          </div>
        )}
      </div>
      
      {/* Lightbox */}
      <Lightbox />
    </>
  )
}

export default BlogLazyImage