import { useMemo, useEffect, useState } from 'react'
import { ClockIcon, EyeIcon } from '@heroicons/react/24/outline'
import { AccessibleIcon } from '../common/AccessibleIcon'
import { ErrorBoundary } from '../common/ErrorBoundary'

export interface BlogReadingTimeProps {
  /** The content to analyze (HTML or plain text) */
  content: string
  /** Words per minute reading speed (default: 200) */
  wordsPerMinute?: number
  /** Display variant */
  variant?: 'default' | 'minimal' | 'detailed' | 'badge'
  /** Whether to show the reading time icon */
  showIcon?: boolean
  /** Whether to include image viewing time */
  includeImages?: boolean
  /** Seconds per image for viewing time calculation */
  imageViewingTime?: number
  /** Custom text formatting */
  customText?: {
    minute?: string
    minutes?: string
    lessThanMinute?: string
    read?: string
  }
  /** Additional CSS classes */
  className?: string
}

interface ReadingTimeStats {
  wordCount: number
  imageCount: number
  readingTimeMinutes: number
  displayText: string
}

const DEFAULT_WORDS_PER_MINUTE = 200
const DEFAULT_IMAGE_VIEWING_TIME = 12 // seconds per image

/**
 * Strip HTML tags and decode HTML entities
 */
const stripHtml = (html: string): string => {
  // Create a temporary div to decode HTML entities
  const temp = document.createElement('div')
  temp.innerHTML = html
  
  // Get text content without HTML tags
  const text = temp.textContent || temp.innerText || ''
  
  return text
}

/**
 * Count words in text
 */
const countWords = (text: string): number => {
  // Remove extra whitespace and split by whitespace
  const words = text.trim().split(/\s+/).filter(word => word.length > 0)
  return words.length
}

/**
 * Count images in HTML content
 */
const countImages = (html: string): number => {
  const imgMatches = html.match(/<img[^>]*>/gi)
  return imgMatches ? imgMatches.length : 0
}

/**
 * Calculate reading time based on content analysis
 */
const calculateReadingTime = (
  content: string,
  wordsPerMinute: number = DEFAULT_WORDS_PER_MINUTE,
  includeImages: boolean = true,
  imageViewingTime: number = DEFAULT_IMAGE_VIEWING_TIME,
  customText?: {
    minute?: string
    minutes?: string
    lessThanMinute?: string
    read?: string
  }
): ReadingTimeStats => {
  // Strip HTML and count words
  const plainText = stripHtml(content)
  const wordCount = countWords(plainText)
  
  // Count images if including them
  const imageCount = includeImages ? countImages(content) : 0
  
  // Calculate base reading time in minutes
  let totalWords = wordCount
  
  // Add equivalent words for image viewing time
  if (includeImages && imageCount > 0) {
    const imageWordEquivalent = (imageCount * imageViewingTime) / 60 * wordsPerMinute
    totalWords += imageWordEquivalent
  }
  
  const readingTimeMinutes = Math.max(1, Math.ceil(totalWords / wordsPerMinute))
  
  return {
    wordCount,
    imageCount,
    readingTimeMinutes,
    displayText: formatReadingTime(readingTimeMinutes, customText)
  }
}

/**
 * Format reading time into human-readable text
 */
const formatReadingTime = (
  minutes: number,
  customText?: {
    minute?: string
    minutes?: string
    lessThanMinute?: string
    read?: string
  }
): string => {
  const text = {
    minute: customText?.minute || 'min',
    minutes: customText?.minutes || 'min',
    lessThanMinute: customText?.lessThanMinute || 'Less than a minute',
    read: customText?.read || 'read'
  }

  if (minutes < 1) {
    return text.lessThanMinute
  }
  
  if (minutes === 1) {
    return `1 ${text.minute} ${text.read}`
  }
  
  return `${minutes} ${text.minutes} ${text.read}`
}

/**
 * Progress indicator showing reading progress
 */
const ReadingProgress: React.FC<{
  readingTimeMinutes: number
  className?: string
}> = ({ readingTimeMinutes, className = '' }) => {
  const [progress, setProgress] = useState(0)
  const [timeSpent, setTimeSpent] = useState(0)

  useEffect(() => {
    const startTime = Date.now()
    
    const updateProgress = () => {
      const elapsed = (Date.now() - startTime) / 1000 / 60 // minutes
      setTimeSpent(elapsed)
      setProgress(Math.min(100, (elapsed / readingTimeMinutes) * 100))
    }

    const interval = setInterval(updateProgress, 1000)
    return () => clearInterval(interval)
  }, [readingTimeMinutes])

  const progressWidth = Math.min(progress, 100)
  const isComplete = progress >= 100

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Reading Progress</span>
        <span>{Math.round(progress)}%</span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${
            isComplete ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{Math.round(timeSpent * 60)}s read</span>
        {isComplete && (
          <span className="text-green-600 font-medium">Complete!</span>
        )}
      </div>
    </div>
  )
}

const BlogReadingTimeInner: React.FC<BlogReadingTimeProps> = ({
  content,
  wordsPerMinute = DEFAULT_WORDS_PER_MINUTE,
  variant = 'default',
  showIcon = true,
  includeImages = true,
  imageViewingTime = DEFAULT_IMAGE_VIEWING_TIME,
  customText,
  className = ''
}) => {
  const stats = useMemo(() => 
    calculateReadingTime(content, wordsPerMinute, includeImages, imageViewingTime, customText),
    [content, wordsPerMinute, includeImages, imageViewingTime, customText]
  )

  if (!content || stats.wordCount === 0) {
    return null
  }

  const iconSize = variant === 'minimal' ? 'h-3 w-3' : 'h-4 w-4'
  const textSize = variant === 'minimal' ? 'text-xs' : 'text-sm'

  if (variant === 'badge') {
    return (
      <span className={`
        inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
        bg-gray-100 text-gray-700 ${className}
      `}>
        {showIcon && (
          <AccessibleIcon icon={ClockIcon} className="h-3 w-3 mr-1" />
        )}
        {stats.displayText}
      </span>
    )
  }

  if (variant === 'minimal') {
    return (
      <span className={`inline-flex items-center text-gray-500 ${textSize} ${className}`}>
        {showIcon && (
          <AccessibleIcon icon={ClockIcon} className={`${iconSize} mr-1`} />
        )}
        {stats.displayText}
      </span>
    )
  }

  if (variant === 'detailed') {
    return (
      <div className={`space-y-3 ${className}`}>
        {/* Main reading time */}
        <div className="flex items-center text-gray-600">
          {showIcon && (
            <AccessibleIcon icon={ClockIcon} className={`${iconSize} mr-2`} />
          )}
          <span className={`font-medium ${textSize}`}>
            {stats.displayText}
          </span>
        </div>

        {/* Detailed stats */}
        <div className="flex items-center space-x-4 text-xs text-gray-500">
          <div className="flex items-center">
            <AccessibleIcon icon={EyeIcon} className="h-3 w-3 mr-1" />
            <span>{stats.wordCount.toLocaleString()} words</span>
          </div>
          
          {includeImages && stats.imageCount > 0 && (
            <div className="flex items-center">
              <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
              <span>{stats.imageCount} images</span>
            </div>
          )}
          
          <div>
            <span>{wordsPerMinute} WPM</span>
          </div>
        </div>

        {/* Reading progress */}
        <ReadingProgress 
          readingTimeMinutes={stats.readingTimeMinutes}
          className="mt-4"
        />
      </div>
    )
  }

  // Default variant
  return (
    <div className={`flex items-center text-gray-600 ${textSize} ${className}`}>
      {showIcon && (
        <AccessibleIcon icon={ClockIcon} className={`${iconSize} mr-2 flex-shrink-0`} />
      )}
      <span>
        {stats.displayText}
        {variant === 'default' && stats.wordCount > 0 && (
          <span className="ml-2 text-gray-400">
            ({stats.wordCount.toLocaleString()} words)
          </span>
        )}
      </span>
    </div>
  )
}

/**
 * Blog Reading Time Component
 * 
 * Calculates and displays estimated reading time for blog content with:
 * - Accurate word counting with HTML tag removal
 * - Image viewing time calculation
 * - Multiple display variants (default, minimal, detailed, badge)
 * - Customizable reading speed (WPM)
 * - Reading progress tracking (detailed variant)
 * - Accessibility features
 * - Responsive design
 * 
 * Features:
 * - Strips HTML tags for accurate word counting
 * - Accounts for image viewing time
 * - Supports custom text formatting
 * - Real-time reading progress tracking
 * - Multiple display variants for different contexts
 * 
 * @example
 * ```tsx
 * <BlogReadingTime
 *   content={blogPost.content}
 *   variant="detailed"
 *   includeImages={true}
 *   wordsPerMinute={250}
 *   customText={{
 *     read: 'to read',
 *     minute: 'minute',
 *     minutes: 'minutes'
 *   }}
 * />
 * ```
 */
export const BlogReadingTime: React.FC<BlogReadingTimeProps> = (props) => {
  return (
    <ErrorBoundary>
      <BlogReadingTimeInner {...props} />
    </ErrorBoundary>
  )
}

export default BlogReadingTime