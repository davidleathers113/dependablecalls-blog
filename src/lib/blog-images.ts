import { supabase } from './supabase'

// Image transformation options
export interface ImageTransformOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'jpeg' | 'png' | 'avif'
  resize?: 'cover' | 'contain' | 'fill'
  crop?: 'center' | 'top' | 'bottom' | 'left' | 'right'
}

// Image metadata
export interface ImageMetadata {
  url: string
  width?: number
  height?: number
  size?: number
  format?: string
  alt?: string
  caption?: string
}

// Supabase storage bucket name
const BLOG_IMAGES_BUCKET = 'blog-images'

/**
 * Check if a URL is a Supabase Storage URL
 */
export function isSupabaseStorageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.includes('supabase') && urlObj.pathname.includes('/storage/v1/object/')
  } catch {
    return false
  }
}

/**
 * Transform a Supabase Storage URL with optimization parameters
 */
export function transformSupabaseImage(
  originalUrl: string, 
  options: ImageTransformOptions = {}
): string {
  if (!isSupabaseStorageUrl(originalUrl)) {
    return originalUrl
  }

  try {
    const url = new URL(originalUrl)
    
    // Add transformation parameters
    if (options.width) {
      url.searchParams.set('width', options.width.toString())
    }
    
    if (options.height) {
      url.searchParams.set('height', options.height.toString())
    }
    
    if (options.quality && options.quality >= 1 && options.quality <= 100) {
      url.searchParams.set('quality', options.quality.toString())
    }
    
    if (options.format) {
      url.searchParams.set('format', options.format)
    }
    
    if (options.resize) {
      url.searchParams.set('resize', options.resize)
    }
    
    return url.toString()
  } catch {
    return originalUrl
  }
}

/**
 * Generate multiple image sizes for responsive images
 */
export function generateResponsiveImageSizes(
  originalUrl: string,
  breakpoints: number[] = [320, 640, 768, 1024, 1280, 1920]
): Array<{ url: string; width: number }> {
  return breakpoints.map(width => ({
    url: transformSupabaseImage(originalUrl, { width, quality: 80, format: 'webp' }),
    width
  }))
}

/**
 * Create a low-quality image placeholder (LQIP) URL
 */
export function createLQIP(originalUrl: string): string {
  return transformSupabaseImage(originalUrl, {
    width: 40,
    height: 40,
    quality: 10,
    format: 'jpeg'
  })
}

/**
 * Get optimized image URL based on device pixel ratio and viewport
 */
export function getOptimizedImageUrl(
  originalUrl: string,
  containerWidth: number,
  devicePixelRatio: number = window.devicePixelRatio || 1
): string {
  const targetWidth = Math.ceil(containerWidth * devicePixelRatio)
  
  return transformSupabaseImage(originalUrl, {
    width: targetWidth,
    quality: devicePixelRatio > 1 ? 75 : 80, // Slightly lower quality for high-DPI
    format: 'webp'
  })
}

/**
 * Upload image to Supabase Storage
 */
export async function uploadBlogImage(
  file: File,
  path: string,
  options: {
    upsert?: boolean
    cacheControl?: string
    contentType?: string
  } = {}
): Promise<{ url: string; error: Error | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(BLOG_IMAGES_BUCKET)
      .upload(path, file, {
        upsert: options.upsert || false,
        cacheControl: options.cacheControl || '3600',
        contentType: options.contentType || file.type
      })

    if (error) {
      return { url: '', error }
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(BLOG_IMAGES_BUCKET)
      .getPublicUrl(data.path)

    return { url: publicUrlData.publicUrl, error: null }
  } catch (error) {
    return { 
      url: '', 
      error: error instanceof Error ? error : new Error('Upload failed') 
    }
  }
}

/**
 * Delete image from Supabase Storage
 */
export async function deleteBlogImage(path: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase.storage
      .from(BLOG_IMAGES_BUCKET)
      .remove([path])

    return { success: !error, error }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error('Delete failed') 
    }
  }
}

/**
 * Get image metadata from Supabase Storage
 */
export async function getBlogImageMetadata(path: string): Promise<ImageMetadata | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BLOG_IMAGES_BUCKET)
      .list(path.split('/').slice(0, -1).join('/'), {
        search: path.split('/').pop()
      })

    if (error || !data || data.length === 0) {
      return null
    }

    const file = data[0]
    const { data: publicUrlData } = supabase.storage
      .from(BLOG_IMAGES_BUCKET)
      .getPublicUrl(path)

    return {
      url: publicUrlData.publicUrl,
      size: file.metadata?.size,
      format: file.metadata?.mimetype?.split('/')[1],
      width: file.metadata?.width,
      height: file.metadata?.height
    }
  } catch {
    return null
  }
}

/**
 * Validate image file before upload
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: 'Invalid file type. Only JPEG, PNG, WebP, and AVIF are allowed.' 
    }
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024 // 10MB
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: 'File size too large. Maximum size is 10MB.' 
    }
  }

  return { valid: true }
}

/**
 * Generate a unique filename for uploaded images
 */
export function generateImagePath(
  originalName: string,
  prefix: string = 'blog'
): string {
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(2, 8)
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg'
  const sanitizedName = originalName
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9-_]/g, '-') // Replace special chars with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50) // Limit length

  return `${prefix}/${timestamp}-${randomId}-${sanitizedName}.${extension}`
}

/**
 * Create srcSet string for responsive images
 */
export function createSrcSet(
  originalUrl: string,
  widths: number[] = [320, 640, 768, 1024, 1280, 1920]
): string {
  return widths
    .map(width => {
      const url = transformSupabaseImage(originalUrl, { 
        width, 
        quality: 80, 
        format: 'webp' 
      })
      return `${url} ${width}w`
    })
    .join(', ')
}

/**
 * Create sizes attribute for responsive images
 */
export function createSizesAttribute(
  breakpoints: Array<{ breakpoint: number; size: string }> = [
    { breakpoint: 640, size: '100vw' },
    { breakpoint: 768, size: '50vw' },
    { breakpoint: 1024, size: '33vw' },
    { breakpoint: 1280, size: '25vw' }
  ]
): string {
  return breakpoints
    .map(({ breakpoint, size }, index) => {
      if (index === breakpoints.length - 1) {
        return size
      }
      return `(max-width: ${breakpoint}px) ${size}`
    })
    .join(', ')
}

/**
 * Preload critical images
 */
export function preloadImage(src: string, priority: 'high' | 'low' = 'low'): void {
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = src
  if (priority === 'high') {
    link.fetchPriority = 'high'
  }
  document.head.appendChild(link)
}

/**
 * Get the dominant color from an image for placeholder backgrounds
 */
export async function getDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        resolve('#f3f4f6') // Default gray
        return
      }
      
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      
      // Sample pixels and find dominant color
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const pixels = imageData.data
      const colorMap: { [key: string]: number } = {}
      
      // Sample every 10th pixel for performance
      for (let i = 0; i < pixels.length; i += 40) {
        const r = pixels[i]
        const g = pixels[i + 1]
        const b = pixels[i + 2]
        const color = `rgb(${r}, ${g}, ${b})`
        colorMap[color] = (colorMap[color] || 0) + 1
      }
      
      // Find most common color
      const dominantColor = Object.entries(colorMap)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || '#f3f4f6'
      
      resolve(dominantColor)
    }
    
    img.onerror = () => resolve('#f3f4f6')
    img.src = imageUrl
  })
}

/**
 * Check if WebP is supported by the browser
 */
export function isWebPSupported(): boolean {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
}

/**
 * Get the best image format for the current browser
 */
export function getBestImageFormat(): 'avif' | 'webp' | 'jpeg' {
  // Check for AVIF support
  const avifCanvas = document.createElement('canvas')
  avifCanvas.width = 1
  avifCanvas.height = 1
  if (avifCanvas.toDataURL('image/avif').indexOf('data:image/avif') === 0) {
    return 'avif'
  }
  
  // Check for WebP support
  if (isWebPSupported()) {
    return 'webp'
  }
  
  // Fallback to JPEG
  return 'jpeg'
}