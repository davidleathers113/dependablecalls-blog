/**
 * Blog Image Optimization - Usage Examples
 * 
 * This file demonstrates how to use the blog image optimization utilities
 * throughout the DCE blog system.
 */

import {
  optimizeImageUrl,
  generateResponsiveSrcSet,
  generateBlurPlaceholder,
  createLazyLoadObserver,
  validateImageUrl,
  generateAltTextSuggestions,
  getImageMetadata,
  uploadOptimizedImage,
  deleteImage,
  getImagePerformanceMetrics,
  defaultResponsiveConfig,
  defaultLazyLoadOptions,
  type ImageTransformOptions,
  type ResponsiveImageConfig
} from './blog-images'

// ============================================================================
// BASIC URL OPTIMIZATION
// ============================================================================

/**
 * Example: Optimize a Supabase storage image URL
 */
export function optimizeFeaturedImage(originalUrl: string): string {
  // Optimize for featured image display (1200x630 for social sharing)
  return optimizeImageUrl(originalUrl, {
    width: 1200,
    height: 630,
    quality: 85,
    format: 'webp',
    resize: 'cover'
  })
}

/**
 * Example: Optimize author avatar
 */
export function optimizeAuthorAvatar(originalUrl: string, size: 'sm' | 'md' | 'lg' = 'md'): string {
  const dimensions = { sm: 32, md: 48, lg: 64 }
  
  return optimizeImageUrl(originalUrl, {
    width: dimensions[size],
    height: dimensions[size],
    quality: 90,
    format: 'webp',
    resize: 'cover'
  })
}

// ============================================================================
// RESPONSIVE IMAGES
// ============================================================================

/**
 * Example: Generate responsive images for blog post content
 */
export function createResponsiveBlogImage(originalUrl: string) {
  const config: ResponsiveImageConfig = {
    breakpoints: [320, 640, 768, 1024, 1280],
    formats: ['avif', 'webp', 'jpeg'],
    quality: 85,
    loading: 'lazy'
  }
  
  return generateResponsiveSrcSet(originalUrl, config)
}

/**
 * Example: Hero image with multiple formats
 */
export function createHeroImageSet(originalUrl: string) {
  return generateResponsiveSrcSet(originalUrl, {
    breakpoints: [400, 800, 1200, 1600, 2400],
    formats: ['avif', 'webp', 'jpeg'],
    quality: 90,
    loading: 'eager' // Hero images should load immediately
  })
}

// ============================================================================
// LAZY LOADING SETUP
// ============================================================================

/**
 * Example: Set up lazy loading for blog images
 */
export function setupBlogImageLazyLoading(): IntersectionObserver | null {
  return createLazyLoadObserver({
    rootMargin: '50px', // Start loading 50px before entering viewport
    threshold: 0.1,     // Trigger when 10% visible
    unobserveOnLoad: true,
    fadeInDuration: 300,
    errorRetries: 2
  })
}

/**
 * Example: Initialize lazy loading for a blog page
 */
export function initializeBlogPageLazyLoading(): void {
  const observer = setupBlogImageLazyLoading()
  
  if (observer) {
    // Find all images with data-src attribute
    const lazyImages = document.querySelectorAll('img[data-src]')
    
    lazyImages.forEach((img) => {
      observer.observe(img)
    })
  }
}

// ============================================================================
// PLACEHOLDER GENERATION
// ============================================================================

/**
 * Example: Generate blur placeholders for featured images
 */
export async function generateFeaturedImagePlaceholder(originalUrl: string): Promise<string | null> {
  return generateBlurPlaceholder(originalUrl, {
    width: 20,   // Small for fast generation
    height: 10,  // Maintain aspect ratio
    quality: 30, // Low quality for small size
    format: 'jpeg'
  })
}

/**
 * Example: Generate tiny placeholders for thumbnails
 */
export async function generateThumbnailPlaceholder(originalUrl: string): Promise<string | null> {
  return generateBlurPlaceholder(originalUrl, {
    width: 10,
    height: 10,
    quality: 20,
    format: 'jpeg'
  })
}

// ============================================================================
// ALT TEXT GENERATION
// ============================================================================

/**
 * Example: Generate alt text for featured images
 */
export function generateFeaturedImageAlt(imageUrl: string, blogTitle: string, category?: string) {
  return generateAltTextSuggestions(imageUrl, {
    blogTitle,
    category,
    isFeatured: true
  })
}

/**
 * Example: Generate alt text for author avatars
 */
export function generateAuthorAvatarAlt(imageUrl: string, authorName: string) {
  return generateAltTextSuggestions(imageUrl, {
    authorName,
    isAvatar: true
  })
}

// ============================================================================
// IMAGE VALIDATION AND SECURITY
// ============================================================================

/**
 * Example: Validate user-uploaded images
 */
export function validateBlogImage(imageUrl: string): { isValid: boolean; message?: string } {
  const validation = validateImageUrl(imageUrl)
  
  return {
    isValid: validation.isValid,
    message: validation.reason
  }
}

/**
 * Example: Batch validate multiple images
 */
export function validateBlogImages(imageUrls: string[]): Array<{ url: string; isValid: boolean; message?: string }> {
  return imageUrls.map(url => ({
    url,
    ...validateBlogImage(url)
  }))
}

// ============================================================================
// METADATA EXTRACTION
// ============================================================================

/**
 * Example: Extract metadata for blog image analysis
 */
export async function analyzeBlogImage(imageUrl: string) {
  const metadata = await getImageMetadata(imageUrl)
  
  if (!metadata) {
    return null
  }
  
  return {
    ...metadata,
    isLandscape: metadata.aspectRatio > 1,
    isPortrait: metadata.aspectRatio < 1,
    isSquare: metadata.aspectRatio === 1,
    recommendedBreakpoints: generateBreakpoints(metadata.width),
    suitableForHero: metadata.width >= 1200 && metadata.height >= 600
  }
}

function generateBreakpoints(originalWidth: number): number[] {
  const baseBreakpoints = [320, 640, 768, 1024, 1280, 1920]
  return baseBreakpoints.filter(bp => bp <= originalWidth)
}

// ============================================================================
// SUPABASE STORAGE INTEGRATION
// ============================================================================

/**
 * Example: Upload and optimize blog featured image
 */
export async function uploadBlogFeaturedImage(
  file: File,
  blogSlug: string
): Promise<{ url: string | null; error: string | null }> {
  const path = `blog/featured/${blogSlug}-${Date.now()}.webp`
  
  return uploadOptimizedImage(file, 'blog-images', path, {
    width: 1200,
    height: 630,
    quality: 85,
    format: 'webp',
    resize: 'cover'
  })
}

/**
 * Example: Upload author avatar
 */
export async function uploadAuthorAvatar(
  file: File,
  authorId: string
): Promise<{ url: string | null; error: string | null }> {
  const path = `authors/${authorId}/avatar-${Date.now()}.webp`
  
  return uploadOptimizedImage(file, 'blog-images', path, {
    width: 200,
    height: 200,
    quality: 90,
    format: 'webp',
    resize: 'cover'
  })
}

/**
 * Example: Clean up old blog images
 */
export async function cleanupBlogImages(imagePaths: string[]): Promise<void> {
  const results = await Promise.allSettled(
    imagePaths.map(path => deleteImage('blog-images', path))
  )
  
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(`Failed to delete image: ${imagePaths[index]}`, result.reason)
    }
  })
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Example: Monitor blog image performance
 */
export function trackBlogImagePerformance() {
  const metrics = getImagePerformanceMetrics()
  
  // Log performance data
  console.log('Blog Image Performance Metrics:', metrics)
  
  // You could send this to your analytics service
  // analyticsService.track('blog_image_performance', metrics)
  
  return metrics
}

/**
 * Example: Performance-aware image loading
 */
export function loadImageWithPerformanceTracking(
  imageUrl: string,
  options: ImageTransformOptions = {}
): Promise<string> {
  const startTime = performance.now()
  
  return new Promise((resolve, reject) => {
    const optimizedUrl = optimizeImageUrl(imageUrl, options)
    const img = new Image()
    
    img.onload = () => {
      const loadTime = performance.now() - startTime
      
      // Record performance metric
      console.log(`Image loaded in ${loadTime.toFixed(2)}ms:`, optimizedUrl)
      
      resolve(optimizedUrl)
    }
    
    img.onerror = () => {
      const loadTime = performance.now() - startTime
      console.warn(`Image failed to load after ${loadTime.toFixed(2)}ms:`, optimizedUrl)
      reject(new Error(`Failed to load image: ${imageUrl}`))
    }
    
    img.src = optimizedUrl
  })
}

// ============================================================================
// INTEGRATION WITH EXISTING BLOG COMPONENTS
// ============================================================================

/**
 * Example: Enhanced BlogPostCard with optimized images
 */
export function enhanceBlogPostCard(post: {
  title: string
  featured_image_url?: string | null
  author?: { display_name?: string }
  categories?: Array<{ name: string }>
}) {
  if (!post.featured_image_url) return null
  
  const responsiveImage = createResponsiveBlogImage(post.featured_image_url)
  const altSuggestions = generateFeaturedImageAlt(
    post.featured_image_url,
    post.title,
    post.categories?.[0]?.name
  )
  
  return {
    optimizedUrl: optimizeImageUrl(post.featured_image_url, {
      width: 400,
      height: 250,
      quality: 85,
      format: 'webp'
    }),
    responsiveImage,
    suggestedAlt: altSuggestions[0]?.suggestion || `Featured image for "${post.title}"`,
    blurPlaceholder: generateFeaturedImagePlaceholder(post.featured_image_url)
  }
}

// ============================================================================
// CONFIGURATION PRESETS
// ============================================================================

/**
 * Example: Configuration presets for different use cases
 */
export const blogImagePresets = {
  // Featured images (social sharing optimized)
  featured: {
    transformOptions: {
      width: 1200,
      height: 630,
      quality: 85,
      format: 'webp' as const,
      resize: 'cover' as const
    },
    responsiveConfig: {
      breakpoints: [400, 800, 1200],
      formats: ['avif', 'webp', 'jpeg'],
      quality: 85,
      loading: 'lazy' as const
    }
  },
  
  // Thumbnail images
  thumbnail: {
    transformOptions: {
      width: 300,
      height: 200,
      quality: 80,
      format: 'webp' as const,
      resize: 'cover' as const
    },
    responsiveConfig: {
      breakpoints: [150, 300],
      formats: ['webp', 'jpeg'],
      quality: 80,
      loading: 'lazy' as const
    }
  },
  
  // Author avatars
  avatar: {
    transformOptions: {
      width: 100,
      height: 100,
      quality: 90,
      format: 'webp' as const,
      resize: 'cover' as const
    },
    responsiveConfig: {
      breakpoints: [50, 100, 200],
      formats: ['webp', 'jpeg'],
      quality: 90,
      loading: 'lazy' as const
    }
  },
  
  // Inline content images
  inline: {
    transformOptions: {
      width: 800,
      quality: 85,
      format: 'auto' as const,
      resize: 'inside' as const
    },
    responsiveConfig: {
      breakpoints: [400, 600, 800, 1000],
      formats: ['avif', 'webp', 'jpeg'],
      quality: 85,
      loading: 'lazy' as const
    }
  }
} as const

export default {
  optimizeFeaturedImage,
  optimizeAuthorAvatar,
  createResponsiveBlogImage,
  setupBlogImageLazyLoading,
  generateFeaturedImageAlt,
  validateBlogImage,
  analyzeBlogImage,
  uploadBlogFeaturedImage,
  trackBlogImagePerformance,
  enhanceBlogPostCard,
  blogImagePresets
}